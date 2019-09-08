import tl = require("azure-pipelines-task-lib/task");

import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest-v2/azure-arm-resource");
import utils = require("./Utils");
import { sleepFor } from 'azure-arm-rest-v2/webClient';
import { DeploymentParameters } from "./DeploymentParameters";

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    public resourceManagementClient: armResource.ResourceManagementClient;

    constructor(resourceManagementClient: armResource.ResourceManagementClient, taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.resourceManagementClient = resourceManagementClient;

    }

    public async createOrUpdateResourceGroup(): Promise<void> {
        await this.createResourceGroupIfRequired();
        await this.createTemplateDeployment(this.resourceManagementClient);
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
            this.resourceManagementClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, utils.getError(error)));
                }
                console.log(tl.loc("DeletedResourceGroup", this.taskParameters.resourceGroupName));
                resolve();
            });
        });
    }

    private async createResourceGroupIfRequired() {
        var exists = await this.checkResourceGroupExistence()
        if (!exists) {
            await this.createResourceGroup();
        }
    }

    private checkResourceGroupExistence(): Promise<boolean> {
        console.log(tl.loc("CheckResourceGroupExistence", this.taskParameters.resourceGroupName));
        return new Promise<boolean>((resolve, reject) => {
            this.resourceManagementClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupStatusFetchFailed", utils.getError(error)));
                }
                console.log(tl.loc("ResourceGroupStatus", exists));
                resolve(exists);
            });
        });
    }

    private createResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            this.resourceManagementClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupCreationFailed", utils.getError(error)));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment: DeploymentParameters): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            this.taskParameters.deploymentName = this.taskParameters.deploymentName || utils.createDeploymentName(this.taskParameters);
            console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
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

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deploymentParameters: DeploymentParameters, retryCount = 0): Promise<void> {
        if (deploymentParameters.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deploymentParameters);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                this.taskParameters.deploymentName = this.taskParameters.deploymentName || utils.createDeploymentName(this.taskParameters);
                console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
                armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.taskParameters.deploymentName, deploymentParameters, (error, result, request, response) => {
                    if (error) {
                        if(error.code == "ResourceGroupNotFound" && retryCount > 0){
                            return this.waitAndPerformAzureDeployment(armClient, deploymentParameters, retryCount);
                        }
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

    private async waitAndPerformAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: DeploymentParameters, retryCount): Promise<void> {
        await sleepFor(3);
        return this.performAzureDeployment(armClient, deployment, retryCount - 1);
    }

    private async createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deploymentParameters: DeploymentParameters;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deploymentParameters = utils.getDeploymentDataForLinkedArtifact(this.taskParameters);
        } else if (this.taskParameters.templateLocation === "URL of the file") {
            deploymentParameters = await utils.getDeploymentObjectForPublicURL(this.taskParameters);
        } else {
            throw new Error(tl.loc("InvalidTemplateLocation"));
        }
        await this.performAzureDeployment(armClient, deploymentParameters, 3);
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}