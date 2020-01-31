import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import armDeployTaskParameters = require("./models/TaskParameters");
import resourceGroup = require("./operations/ResourceGroup");
import armResource = require("azure-arm-rest-v2/azure-arm-resource");
import armManagementGroup = require("azure-arm-rest-v2/azure-arm-management-group");
import armSubscription = require("azure-arm-rest-v2/azure-arm-subscription");

import { DeploymentParameters } from "./operations/DeploymentParameters";
import { DeploymentScopeBase } from "./operations/DeploymentScopeBase";

function run(): Promise<void> {
    var taskParameters = new armDeployTaskParameters.TaskParameters();
    return taskParameters.getTaskParameters().then((taskParameters) => {

        //Telemetry
        var deploymentScopeTelemetry = {
            deploymentScope: taskParameters.deploymentScope,
            deploymentMode: taskParameters.deploymentMode
        };
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureResourceManagerTemplateDeployment]" + JSON.stringify(deploymentScopeTelemetry));

        if(taskParameters.deploymentScope === "Management Group"){
            var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
            var managementGroupOperationsController = new DeploymentScopeBase(
                new armManagementGroup.ManagementGroupManagementClient(
                    taskParameters.credentials,
                    taskParameters.managementGroupId),
                taskParameters,
                deploymentParameters);
            return managementGroupOperationsController.deploy();
        }
        else if(taskParameters.deploymentScope === "Subscription") {
            var deploymentParameters = new DeploymentParameters({}, taskParameters.location);
            var subscriptionOperationsController = new DeploymentScopeBase(
                new armSubscription.SubscriptionManagementClient(
                    taskParameters.credentials,
                    taskParameters.subscriptionId),
                taskParameters,
                deploymentParameters);
            return subscriptionOperationsController.deploy();
        }
        var resourceGroupOperationsController = new resourceGroup.ResourceGroup(
            new armResource.ResourceManagementClient(
                taskParameters.credentials,
                taskParameters.resourceGroupName,
                taskParameters.subscriptionId),
            taskParameters);
        switch (taskParameters.action) {
            case "Create Or Update Resource Group":
                return resourceGroupOperationsController.deploy();
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
tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) =>
    tl.setResult(tl.TaskResult.Failed, error)
);
