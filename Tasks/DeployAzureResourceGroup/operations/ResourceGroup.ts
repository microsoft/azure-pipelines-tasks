/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 
/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/vso-node-api.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import q = require("q");
var httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient("VSTS_AGENT");

import env = require("./Environment");
import deployAzureRG = require("../models/DeployAzureRG");
import winRM = require("./WinRMHttpsListener");

var parameterParse = require("./ParameterParse").parse;
import armResource = require("./azure-rest/azure-arm-resource");

class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode) {
        this.properties["mode"] = mode;
        this.properties["debugSetting"] = { "detailLevel": "requestContent, responseContent" };
    }
}


function isNonEmpty(str: string) {
    return str && str.trim();
}

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private WinRMHttpsListener: winRM.WinRMHttpsListener;
    private envController: env.RegisterEnvironment;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.WinRMHttpsListener = new winRM.WinRMHttpsListener(this.taskParameters);
        this.envController = new env.RegisterEnvironment(this.taskParameters);
    }

    public async createOrUpdateResourceGroup(): Promise<string> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.createResourceGroupIfRequired(armClient, await this.checkResourceGroupExistence(armClient));
        await this.createTemplateDeployment(armClient);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
        return tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName);
    }

    public deleteResourceGroup(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
            console.log(tl.loc("ARG_DeletingResourceGroup", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("RGO_CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, error.message));
                }
                resolve(tl.loc("RGO_DeletedResourceGroup", this.taskParameters.resourceGroupName));
            });
        });
    }

    public async selectResourceGroup(): Promise<string> {
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient, true);
        return tl.loc("SelectResourceGroupSuccessful", this.taskParameters.resourceGroupName, this.taskParameters.outputVariable);
    }

    private async registerEnvironmentIfRequired(armClient: armResource.ResourceManagementClient, isRequired?: boolean) {
        if (isNonEmpty(this.taskParameters.outputVariable) || isRequired) {
            try {
                await this.envController.RegisterEnvironment();
            } catch (error) {
                throw tl.loc("FailedRegisteringEnvironment", error);
            }
        }
    }

    private async enableDeploymentPrerequestiesIfRequired(armClient) {
        if (this.taskParameters.enableDeploymentPrerequisites) {
            console.log(tl.loc("EnablingWinRM"));
            await this.WinRMHttpsListener.EnableWinRMHttpsListener();
        }
    }

    private async createResourceGroupIfRequired(armClient, exists) {
        if (!exists) {
            await this.createResourceGroup(armClient);
        }
    }

    private checkResourceGroupExistence(armClient: armResource.ResourceManagementClient): q.Promise<boolean> {
        var deferred = q.defer<boolean>();
        armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
            if (error) {
                deferred.reject(tl.loc("ResourceGroupStatusFetchFailed", error));
            }
            deferred.resolve(exists);
        });
        return deferred.promise;
    }

    private createDeploymentName(): string {
        var name;
        if (this.taskParameters.templateLocation == "Linked artifact")
            name = this.taskParameters.csmFile;
        else
            name = this.taskParameters.csmFileLink;
        name = path.basename(name).split(".")[0].replace(" ", "");
        var ts = new Date(Date.now());
        var depName = util.format("%s-%s%s%s-%s%s", name, ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes());
        return depName;
    }

    private updateOverrideParameters(parameters: Object): Object {
        if (!this.taskParameters.overrideParameters || !this.taskParameters.overrideParameters.trim()) {
            return parameters;
        }
        tl.debug("Overriding Parameters..");

        var override = parameterParse(this.taskParameters.overrideParameters);
        for (var key in override) {
            tl.debug("Overriding key: "+ key);
            parameters[key] = override[key];
        }

        return parameters;
    }

    private createResourceGroup(armClient: armResource.ResourceManagementClient): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log(tl.loc("RGNotFound", this.taskParameters.resourceGroupName));
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("ResourceGroupCreationFailed", error));
                }
                console.log(tl.loc("CreatedRG"));
                resolve("Succeeded");
            });
        });
    }

    private parseParameters(contents): Object {
        try {
            return JSON.parse(contents).parameters;
        } catch (error) {
            throw tl.loc("ParametersFileParsingFailed", error.message);
        }
    }

    private requestParametersFile(url): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            httpObj.get("GET", url, {}, (error, result, contents) => {
                if (error) {
                    reject(tl.loc("ParametersFileFetchFailed", error));
                }
                if (result.statusCode === 200)
                    resolve(contents);
                else {
                    var errorMessage = result.statusCode.toString() + ": " + result.statusMessage;
                    reject(tl.loc("ParametersFileFetchFailed", errorMessage));
                }
            });
        });
    }

    private getDeploymentDataForLinkedArtifact(): Deployment {
        console.log(tl.loc("GettingDeploymentDataFromLinkedArtifact"));
        var template: Object;
        try {
            tl.debug("Loading CSM Template File.. " + this.taskParameters.csmFile);
            template = JSON.parse(fs.readFileSync(this.taskParameters.csmFile, 'UTF-8'));
            tl.debug("Loaded CSM File");
        }
        catch (error) {
            throw (tl.loc("TemplateParsingFailed", error.message));
        }
        var parameters = {};
        try {
            if (this.taskParameters.csmParametersFile && this.taskParameters.csmParametersFile.trim()) {
                if (!fs.lstatSync(this.taskParameters.csmParametersFile).isDirectory()) {
                    tl.debug("Loading Parameters File.. " + this.taskParameters.csmParametersFile);
                    var parameterFile = fs.readFileSync(this.taskParameters.csmParametersFile, 'UTF-8');
                    tl.debug("Loaded Parameters File");
                    parameters = this.parseParameters(parameterFile);
                }
            }
        }
        catch (error) {
            throw (tl.loc("ParametersFileParsingFailed", error.message));
        }
        var deployment = new Deployment({
            template: template,
            parameters: parameters
        });
        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private async getDeploymentObjectForPublicURL(): Promise<Deployment> {
        var properties = {};
        properties["templateLink"] = {
            uri: this.taskParameters.csmFileLink
        };
        var parameters = {};
        var deployment = new Deployment(properties);

        if (isNonEmpty(this.taskParameters.csmParametersFileLink) && isNonEmpty(this.taskParameters.overrideParameters)) {
            var contents = await this.requestParametersFile(this.taskParameters.csmParametersFileLink)
            parameters = JSON.parse(contents).parameters;
            parameters = this.updateOverrideParameters(parameters);
            deployment.properties["parameters"] = parameters;
        } else if (isNonEmpty(this.taskParameters.csmParametersFileLink)) {
            deployment.properties["parametersLink"] = { "uri": this.taskParameters.csmParametersFileLink };
        } else if (isNonEmpty(this.taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(parameters);
            deployment.properties["parameters"] = parameters;
        }

        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties.mode = "Incremental";
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                }
                console.log(tl.loc("CompletedValidation"));
                if (result.error) {
                    console.log(tl.loc("ErrorsInYourDeployment"));
                    console.log("Error:", result.error.code);
                    tl.error(result.error.message);
                    if (result.error.details) {
                        console.log("Details:");
                        for (var i = 0; i < result.error.details.length; i++) {
                            console.log(i + 1, result.error.details[i].code, result.error.details[i].message, result.error.details[i].details);
                        }
                    }
                    reject(tl.loc("RGO_createTemplateDeploymentFailed", this.taskParameters.resourceGroupName));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve(tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deployment): Promise<string> {
        if (deployment.properties.mode === "Validation") {
            return this.validateDeployment(armClient, deployment);
        } else {
            console.log("Starting Deployment..");
            return new Promise<string>((resolve, reject) => {
                armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, async (error, result, request, response) => {
                    if (error) {
                        reject(tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                    }
                    console.log("Completed Deployment");
                    await this.enableDeploymentPrerequestiesIfRequired(armClient);
                    await this.registerEnvironmentIfRequired(armClient);
                    resolve(tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
                });
            });
        }
    }

    private async createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deployment;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        } else {
            deployment = await this.getDeploymentObjectForPublicURL();
        }
        await this.performAzureDeployment(armClient, deployment);
    }

}
