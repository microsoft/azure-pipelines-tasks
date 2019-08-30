import tl = require("vsts-task-lib/task");

import env = require("./Environment");
import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest/azure-arm-resource");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
import utils = require("./Utils");
import { sleepFor } from 'azure-arm-rest/webClient';
import { DeploymentScopeClient, Deployment } from "./DeploymentScopeClient";

export class ResourceGroup extends DeploymentScopeClient {

    private winRMExtensionHelper: winRM.WinRMExtensionHelper;
    private deploymentGroupExtensionHelper: dgExtensionHelper.DeploymentGroupExtensionHelper;
    private environmentHelper: env.EnvironmentHelper;
    private armClient: armResource.ResourceManagementClient;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        super(taskParameters);
        this.winRMExtensionHelper = new winRM.WinRMExtensionHelper(taskParameters);
        this.deploymentGroupExtensionHelper = new dgExtensionHelper.DeploymentGroupExtensionHelper(taskParameters);
        this.environmentHelper = new env.EnvironmentHelper(taskParameters);
        this.armClient = new armResource.ResourceManagementClient(taskParameters.credentials, taskParameters.subscriptionId);
    }

    public async createOrUpdateResourceGroup(): Promise<void> {
        await this.createResourceGroupIfRequired();        
        await this.performAzureDeployment(await this.getTemplateDeployment(), 3);
        await this.enableDeploymentPrerequestiesIfRequired();
        await this.registerEnvironmentIfRequired();
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var extDelPromise = this.deploymentGroupExtensionHelper.deleteExtensionFromResourceGroup();
            var deleteRG = (val) => {
                console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
                this.armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                    if (error) {
                        return reject(tl.loc("CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, utils.getError(error)));
                    }
                    console.log(tl.loc("DeletedResourceGroup", this.taskParameters.resourceGroupName));
                    resolve();
                });
            }
            extDelPromise.then(deleteRG, deleteRG);
        });
    }

    public async selectResourceGroup(): Promise<void> {
        if (!utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM)) {
            throw tl.loc("OutputVariableShouldNotBeEmpty");
        }

        await this.enableDeploymentPrerequestiesIfRequired();
        await this.registerEnvironmentIfRequired();
    }

    private async registerEnvironmentIfRequired() {
        if (utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone)) {
            await this.environmentHelper.RegisterEnvironment();
        }
    }

    private async enableDeploymentPrerequestiesIfRequired() {
        if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM) {
            await this.winRMExtensionHelper.ConfigureWinRMExtension();
        }
        else if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqDG) {
            await this.deploymentGroupExtensionHelper.addExtensionOnResourceGroup();
        }
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
            this.armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
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
            this.armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupCreationFailed", utils.getError(error)));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }
    
    validateDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
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

    private async performAzureDeployment(deployment: Deployment, retryCount = 0): Promise<void> {
        if (deployment.properties["mode"] === "Validation") {
            return this.validateDeployment(this.armClient, deployment);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                this.taskParameters.deploymentName = this.taskParameters.deploymentName || this.createDeploymentName();
                console.log(tl.loc("LogDeploymentName", this.taskParameters.deploymentName));
                this.armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.taskParameters.deploymentName, deployment, (error, result, request, response) => {
                    if (error) {
                        if(error.code == "ResourceGroupNotFound" && retryCount > 0){
                            return this.waitAndPerformAzureDeployment(deployment, retryCount);
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

    private async waitAndPerformAzureDeployment(deployment: Deployment, retryCount): Promise<void> {
        await sleepFor(3);
        return this.performAzureDeployment(deployment, retryCount - 1);
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}