import tl = require("azure-pipelines-task-lib/task");

import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest-v2/azure-arm-subscription");
import utils = require("./Utils");
import { DeploymentParameters } from "./DeploymentParameters";

export class Subscription {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    public subscriptionManagementClient: armResource.SubscriptionManagementClient;

    constructor(subscriptionManagementClient: armResource.SubscriptionManagementClient, taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.subscriptionManagementClient = subscriptionManagementClient;
    }

    public async deploy(): Promise<void> {
        await this.createTemplateDeployment(this.subscriptionManagementClient);
    }

    private validateDeployment(armClient: armResource.SubscriptionManagementClient, deployment: DeploymentParameters): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            this.taskParameters.deploymentName = this.taskParameters.deploymentName || utils.createDeploymentName(this.taskParameters);
            console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
            armClient.deployments.validate(this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("CreateTemplateDeploymentValidationFailed", utils.getError(error)));
                }
                if (result.error) {
                    utils.writeDeploymentErrors(this.taskParameters, result.error);
                    return reject(tl.loc("CreateTemplateDeploymentFailed"));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve();
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armResource.SubscriptionManagementClient, deploymentParameters: DeploymentParameters, retryCount = 0): Promise<void> {
        if (deploymentParameters.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deploymentParameters);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                this.taskParameters.deploymentName = this.taskParameters.deploymentName || utils.createDeploymentName(this.taskParameters);
                console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
                armClient.deployments.deploy(this.taskParameters.deploymentName, deploymentParameters, (error, result, request, response) => {
                    if (error) {
                        utils.writeDeploymentErrors(this.taskParameters, error);
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

    private async createTemplateDeployment(armClient: armResource.SubscriptionManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deploymentParameters: DeploymentParameters;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deploymentParameters = utils.getDeploymentDataForLinkedArtifact(this.taskParameters);
        } else if (this.taskParameters.templateLocation === "URL of the file") {
            deploymentParameters = await utils.getDeploymentObjectForPublicURL(this.taskParameters);
        } else {
            throw new Error(tl.loc("InvalidTemplateLocation"));
        }
        deploymentParameters.updateLocation(this.taskParameters.location);
        await this.performAzureDeployment(armClient, deploymentParameters, 3);
    }
}