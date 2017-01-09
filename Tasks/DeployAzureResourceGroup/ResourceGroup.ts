/// <reference path="../../definitions/node.d.ts" /> 
/// <reference path="../../definitions/vsts-task-lib.d.ts" /> 
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vso-node-api.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import q = require("q");
var httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient("VSTS_AGENT");

import env = require("./Environment");
import deployAzureRG = require("./DeployAzureRG");
import winRM = require("./WinRMHttpsListener");

var parameterParse = require("./parameterParse").parse;
import armResource = require("./azure-arm-resource");

class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
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

    public createOrUpdateResourceGroup() {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupStatusFetchFailed", error));
                process.exit();
            }
            if (exists) {
                this.createTemplateDeployment(armClient);
            } else {
                this.createRG(armClient).then((Succeeded) => {
                    this.createTemplateDeployment(armClient);
                });
            }
        });
    }

    public deleteResourceGroup() {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        console.log(tl.loc("ARG_DeletingResourceGroup", this.taskParameters.resourceGroupName));
        armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, error.message));
                process.exit();
            }
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_DeletedResourceGroup", this.taskParameters.resourceGroupName));
        });
    }

    public async selectResourceGroup() {
        if (this.taskParameters.enableDeploymentPrerequisites) {
            console.log(tl.loc("EnablingWinRM"));
            await this.WinRMHttpsListener.EnableWinRMHttpsListener();
        }
        try {
            await this.envController.RegisterEnvironment();
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("FailedRegisteringEnvironment", error));
            process.exit();
        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("SelectResourceGroupSuccessful", this.taskParameters.resourceGroupName, this.taskParameters.outputVariable));
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

    private updateOverrideParameters(parameters: Object) {
        if (!this.taskParameters.overrideParameters || !this.taskParameters.overrideParameters.trim()) {
            return parameters;
        }
        tl.debug("Overriding Parameters..");
        var override = parameterParse(this.taskParameters.overrideParameters);
        for (var key in override) {
            parameters[key] = override[key];
        }
        tl.debug("Parameters after overriding." + JSON.stringify(parameters));
        return parameters;
    }

    private createRG(armClient: armResource.ResourceManagementClient): q.Promise<any> {
        var deferred = q.defer<any>();
        console.log(tl.loc("RGNotFound", this.taskParameters.resourceGroupName));
        console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
        armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ResourceGroupCreationFailed", error));
                process.exit();
            }
            console.log(tl.loc("CreatedRG"));
            deferred.resolve("Succeeded");
        });
        return deferred.promise;
    }

    private parseParameters(contents) {
        var params;
        try {
            params = JSON.parse(contents).parameters;
        } catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            process.exit();
        }
        return params;
    }

    private request(url): q.Promise<string> {
        var deferred = q.defer<string>();
        httpObj.get("GET", url, {}, (error, result, contents) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("URLFetchFailed", error));
                process.exit();
            }
            deferred.resolve(contents);
        })
        return deferred.promise;
    }

    private createDeployment(parameters: Object, templateLink?: string, template?: Object): Deployment {
        var properties = {}
        if (templateLink) {
            properties["templateLink"] = { "uri": templateLink };
        }
        if (template) {
            properties["template"] = template;
        }
        if (this.taskParameters.csmParametersFileLink && this.taskParameters.csmParametersFileLink.trim() != "" && (!this.taskParameters.overrideParameters || this.taskParameters.overrideParameters.trim() == ""))
            properties["parametersLink"] = { "uri": this.taskParameters.csmParametersFileLink };
        else {
            var params = parameters;
            params = this.updateOverrideParameters(params);
            properties["parameters"] = params;
        }
        properties["mode"] = this.taskParameters.deploymentMode;
        properties["debugSetting"] = { "detailLevel": "requestContent, responseContent" };
        return new Deployment(properties)
    }

    private getDeploymentDataForLinkedArtifact() {
        console.log(tl.loc("GettingDeploymentDataFromLinkedArtifact"));
        var template;
        try {
            tl.debug("Loading CSM Template File.. " + this.taskParameters.csmFile);
            template = JSON.parse(fs.readFileSync(this.taskParameters.csmFile, 'UTF-8'));
            tl.debug("Loaded CSM File");
            tl.debug("CSM File data: " + JSON.stringify(template));
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("TemplateParsingFailed", error.message));
            process.exit();
        }
        var parameters = {};
        try {
            if (this.taskParameters.csmParametersFile && this.taskParameters.csmParametersFile.trim()) {
                if (!fs.lstatSync(this.taskParameters.csmParametersFile).isDirectory()) {
                    tl.debug("Loading Parameters File.. " + this.taskParameters.csmParametersFile);
                    var parameterFile = fs.readFileSync(this.taskParameters.csmParametersFile, 'UTF-8');
                    tl.debug("Loaded Parameters File");
                    parameters = this.parseParameters(parameterFile);
                    tl.debug("Parameters file data: " + JSON.stringify(parameters));
                }
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("ParametersFileParsingFailed", error.message));
            process.exit();
        }
        return this.createDeployment(parameters, null, template);
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment) {
        console.log(tl.loc("StartingValidation"));
        deployment.properties.mode = "Incremental";
        armClient.deployments.validate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
            if (error) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                process.exit();
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
                tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", this.taskParameters.resourceGroupName));
            } else {
                console.log(tl.loc("ValidDeployment"));
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
            }
        });
    }

    private async startDeployment(armClient: armResource.ResourceManagementClient, deployment) {
        if (deployment.properties.mode === "Validation") {
            this.validateDeployment(armClient, deployment);
        } else {
            console.log("Starting Deployment..");
            armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, async (error, result, request, response) => {
                if (error) {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("RGO_createTemplateDeploymentFailed", error.message));
                    process.exit();
                }
                console.log("Completed Deployment");
                if (this.taskParameters.enableDeploymentPrerequisites) {
                    console.log("Enabling winRM Https Listener on your windows machines..");
                    await this.WinRMHttpsListener.EnableWinRMHttpsListener();
                }

                try {
                    if (this.taskParameters.outputVariable && this.taskParameters.outputVariable.trim() != "") {
                        this.envController.RegisterEnvironment();
                    }
                } catch (error) {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("FailedRegisteringEnvironment", error));
                    process.exit();
                }
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("RGO_createTemplateDeploymentSucceeded", this.taskParameters.resourceGroupName));
            });
        }
    }

    private createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log("Creating Template Deployment")
        if (this.taskParameters.templateLocation === "Linked artifact") {
            var deployment = this.getDeploymentDataForLinkedArtifact();
            this.startDeployment(armClient, deployment);
        } else {
            if (isNonEmpty(this.taskParameters.csmParametersFileLink) && isNonEmpty(this.taskParameters.overrideParameters)) {
                this.request(this.taskParameters.csmParametersFileLink).then((contents) => {
                    var parameters = JSON.parse(contents).parameters;
                    var deployment = this.createDeployment(parameters, this.taskParameters.csmFileLink);
                    this.startDeployment(armClient, deployment);
                });
            } else {
                var deployment = this.createDeployment({}, this.taskParameters.csmFileLink);
                this.startDeployment(armClient, deployment);
            }
        }
    }

}
