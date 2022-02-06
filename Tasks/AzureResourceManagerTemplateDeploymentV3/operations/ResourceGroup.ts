import tl = require("azure-pipelines-task-lib/task");

import armDeployTaskParameters = require("../models/TaskParameters");
import armResource = require("azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource");
import utils = require("./Utils");
import { DeploymentScopeBase } from "./DeploymentScopeBase";

export class ResourceGroup extends DeploymentScopeBase {

    public resourceManagementClient: armResource.ResourceManagementClient;

    constructor(resourceManagementClient: armResource.ResourceManagementClient, taskParameters: armDeployTaskParameters.TaskParameters) {
        super(resourceManagementClient, taskParameters);
        this.resourceManagementClient = resourceManagementClient;
    }

    public async deploy(): Promise<void> {
        await this.createResourceGroupIfRequired();
        await this.createTemplateDeployment();
        utils.deleteGeneratedFiles()
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
            this.resourceManagementClient.resourceGroup.deleteMethod((error, result, request, response) => {
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
            this.resourceManagementClient.resourceGroup.checkExistence((error, exists, request, response) => {
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
            this.resourceManagementClient.resourceGroup.createOrUpdate({ "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupCreationFailed", utils.getError(error)));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }
}