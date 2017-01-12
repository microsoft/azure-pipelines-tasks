/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 
/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/vso-node-api.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
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

    public async createOrUpdateResourceGroup(): Promise<void> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.createResourceGroupIfRequired(armClient);
        await this.createTemplateDeployment(armClient);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
        console.log(tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
            console.log(tl.loc("ARG_DeletingResourceGroup", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("RGO_CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, error.message));
                }
                console.log(tl.loc("RGO_DeletedResourceGroup", this.taskParameters.resourceGroupName));
                resolve();
            });
        });
    }

    public async selectResourceGroup(): Promise<void> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        if (!isNonEmpty(this.taskParameters.outputVariable)) {
            throw tl.loc("OutputVariableShouldNotBeEmpty");
        }

        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
        console.log(tl.loc("SelectResourceGroupSuccessful", this.taskParameters.resourceGroupName, this.taskParameters.outputVariable));        
    }

    private async registerEnvironmentIfRequired(armClient: armResource.ResourceManagementClient) {
        if (isNonEmpty(this.taskParameters.outputVariable)) {
            console.log(tl.loc("RegisteringEnvironmentVariable"));
            await this.envController.RegisterEnvironment();
        }
    }

    private async enableDeploymentPrerequestiesIfRequired(armClient) {
        if (this.taskParameters.enableDeploymentPrerequisites) {
            console.log(tl.loc("EnablingWinRM"));
            await this.WinRMHttpsListener.EnableWinRMHttpsListener();
        }
    }

    private async createResourceGroupIfRequired(armClient: armResource.ResourceManagementClient) {
        var exists = await this.checkResourceGroupExistence(armClient)
        if (!exists) {
            await this.createResourceGroup(armClient);
        }
    }

    private checkResourceGroupExistence(armClient: armResource.ResourceManagementClient): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
                if (error) {
                    reject(tl.loc("ResourceGroupStatusFetchFailed", error));
                }
                resolve(exists);
            });
        });
    }

    private createDeploymentName(): string {
        var name: string;
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
        tl.debug("Overriding Parameters..");

        var override = parameterParse(this.taskParameters.overrideParameters);
        for (var key in override) {
            tl.debug("Overriding key: " + key);
            parameters[key] = override[key];
        }

        return parameters;
    }

    private createResourceGroup(armClient: armResource.ResourceManagementClient): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("RGNotFound", this.taskParameters.resourceGroupName));
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("ResourceGroupCreationFailed", error));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }

    private downloadParametersFile(url): Promise<string> {
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
            if (isNonEmpty(this.taskParameters.csmParametersFile)) {
                if (!fs.lstatSync(this.taskParameters.csmParametersFile).isDirectory()) {
                    tl.debug("Loading Parameters File.. " + this.taskParameters.csmParametersFile);
                    var parameterFile = fs.readFileSync(this.taskParameters.csmParametersFile, 'UTF-8');
                    tl.debug("Loaded Parameters File");
                    parameters = JSON.parse(parameterFile).parameters;
                }
            }
        }
        catch (error) {
            throw (tl.loc("ParametersFileParsingFailed", error.message));
        }

        if (isNonEmpty(this.taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(parameters);
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

        if (isNonEmpty(this.taskParameters.csmParametersFileLink)) {
            if (isNonEmpty(this.taskParameters.overrideParameters)) {
                var contents = await this.downloadParametersFile(this.taskParameters.csmParametersFileLink)
                parameters = JSON.parse(contents).parameters;
            }
            else {
                deployment.properties["parametersLink"] = {
                    uri: this.taskParameters.csmParametersFileLink
                };
            }
        }

        if (isNonEmpty(this.taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(parameters);
            deployment.properties["parameters"] = parameters;
        }

        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                if (error) {
                    reject(tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                }
                console.log(tl.loc("CompletedValidation"));
                if (result.error) {
                    tl.error(tl.loc("ErrorsInYourDeployment"));
                    tl.error(tl.loc("Error", result.error.code));
                    tl.error(result.error.message);
                    if (result.error.details) {
                        console.log(tl.loc("Details"));
                        for (var i = 0; i < result.error.details.length; i++) {
                            console.log(i + 1, result.error.details[i].code, result.error.details[i].message, result.error.details[i].details);
                        }
                    }
                    reject(tl.loc("RGO_createTemplateDeploymentFailed", this.taskParameters.resourceGroupName));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve();
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        if (deployment.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deployment);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, async (error, result, request, response) => {
                    if (error) {
                        reject(tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                    }
                    console.log(tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
                    resolve();
                });
            });
        }
    }

    private async createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deployment: Deployment;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        } else {
            deployment = await this.getDeploymentObjectForPublicURL();
        }
        await this.performAzureDeployment(armClient, deployment);
    }

}
