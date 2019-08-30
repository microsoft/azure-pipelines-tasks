import tl = require("vsts-task-lib/task");
import deployAzureRG = require("../models/DeployAzureRG");
import armManagementGroup = require("azure-arm-rest/azure-arm-managementgroup");
import utils = require("./Utils");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { sleepFor } from 'azure-arm-rest/webClient';
import { DeploymentScopeClient } from "./DeploymentScopeClient";

let proxyUrl: string = tl.getVariable("agent.proxyurl");
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
    proxy: {
        proxyUrl: proxyUrl,
        proxyUsername: tl.getVariable("agent.proxyusername"),
        proxyPassword: tl.getVariable("agent.proxypassword"),
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
    }
} : {};

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";

export class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode: string, location: string) {
        this.properties["mode"] = mode;
        this.properties["location"] = location;
        this.properties["debugSetting"] = { "detailLevel": "requestContent, responseContent" };
    }
}

export class ManagementGroup extends DeploymentScopeClient{

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        super(taskParameters);
    }

    public async deployToManagementGroupScope(): Promise<void> {
        var armClient = new armManagementGroup.ManagementGroupManagementClient(this.taskParameters.credentials, this.taskParameters.managementGroupId);
        await this.performAzureDeployment(armClient, await this.getTemplateDeployment(), 3);
    }
    
    validateDeployment(armClient: armManagementGroup.ManagementGroupManagementClient, deployment: Deployment): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            this.taskParameters.deploymentName = this.taskParameters.deploymentName || this.createDeploymentName();
            console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("CreateTemplateDeploymentValidationFailed", utils.getError(error)));
                }
                if (result.error) {
                    this.writeDeploymentErrors(result.error);
                    return reject(tl.loc("CreateTemplateDeploymentFailed"));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve();
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armManagementGroup.ManagementGroupManagementClient, deployment: Deployment, retryCount = 0): Promise<void> {
        if (deployment.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deployment);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                this.taskParameters.deploymentName = this.taskParameters.deploymentName || this.createDeploymentName();
                console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
                armClient.deployments.executeManagementGroupScopeDeployment(this.taskParameters.resourceGroupName, this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
                    if (error) {
                        if(error.code == "ResourceGroupNotFound" && retryCount > 0){
                            return this.waitAndPerformAzureDeployment(armClient, deployment, retryCount);
                        }
                        this.writeDeploymentErrors(error);
                        return reject(tl.loc("CreateTemplateDeploymentFailed"));
                    }
                    if (result && result["properties"] && result["properties"]["outputs"] && utils.isNonEmpty(this.taskParameters.deploymentOutputs)) {
                        tl.setVariable(this.taskParameters.deploymentOutputs, JSON.stringify(result["properties"]["outputs"]));
                        console.log(tl.loc("AddedOutputVariable", this.taskParameters.deploymentOutputs));
                    }

                    console.log(tl.loc("CreateTemplateDeploymentSucceeded"));
                    resolve();
                });
            });
        }
    }

    private async waitAndPerformAzureDeployment(armClient: armManagementGroup.ManagementGroupManagementClient, deployment: Deployment, retryCount): Promise<void> {
        await sleepFor(3);
        return this.performAzureDeployment(armClient, deployment, retryCount - 1);
    }
}
