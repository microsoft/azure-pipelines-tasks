import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import armDeployTaskParameters = require("./models/ARMDeployTaskParameters");
import resourceGroup = require("./operations/ResourceGroup");
import armResource = require("azure-arm-rest-v2/azure-arm-resource");
import armManagementGroup = require("azure-arm-rest-v2/azure-arm-management-group");
import armSubscription = require("azure-arm-rest-v2/azure-arm-subscription");
import { DeploymentParameters } from "./operations/DeploymentParameters";
import { DeploymentScopeBase } from "./operations/DeploymentScopeBase";

function run(): Promise<void> {
    var armTemplateDeploymentTaskParameters = new armDeployTaskParameters.ARMDeployTaskParameters();
    return armTemplateDeploymentTaskParameters.getARMTemplateDeploymentTaskParameters().then((taskParameters) => {
        if(taskParameters.deploymentScope === "Management Group"){
            var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
            var managementGroupOperationsController = new DeploymentScopeBase(new armManagementGroup.ManagementGroupManagementClient(taskParameters.credentials, taskParameters.managementGroupId), taskParameters, deploymentParameters);
            return managementGroupOperationsController.deploy();
        }
        else if(taskParameters.deploymentScope === "Subscription") {
            var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
            var subscriptionOperationsController = new DeploymentScopeBase(new armSubscription.SubscriptionManagementClient(taskParameters.credentials, taskParameters.subscriptionId), taskParameters, deploymentParameters);
            return subscriptionOperationsController.deploy();
        }
        var resourceGroupOperationsController = new resourceGroup.ResourceGroup(new armResource.ResourceManagementClient(taskParameters.credentials, taskParameters.resourceGroupName, taskParameters.subscriptionId), taskParameters);
        switch (taskParameters.action) {
            case "Create Or Update Resource Group":
                return resourceGroupOperationsController.createOrUpdateResourceGroup();
            case "DeleteRG":
                return resourceGroupOperationsController.deleteResourceGroup();
            default:
                throw tl.loc("InvalidAction", taskParameters.action);
        }
    });
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) =>
    tl.setResult(tl.TaskResult.Failed, error)
);
