import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import deployAzureRG = require("./models/DeployAzureRG");
import resourceGroup = require("./operations/ResourceGroup");
import managementGroup = require("./operations/ManagementGroup");
import subscription = require("./operations/Subscription");
import armResource = require("azure-arm-rest-v2/azure-arm-resource");
import armManagementGroup = require("azure-arm-rest-v2/azure-arm-management-group");
import armSubscription = require("azure-arm-rest-v2/azure-arm-subscription");

function run(): Promise<void> {
    var azureRGTaskParameters = new deployAzureRG.AzureRGTaskParameters();
    return azureRGTaskParameters.getAzureRGTaskParameters().then((taskParameters) => {
        if(taskParameters.deploymentScope === "Management Group"){
            var managementGroupOperationsController = new managementGroup.ManagementGroup(new armManagementGroup.ManagementGroupManagementClient(taskParameters.credentials, taskParameters.managementGroupId), taskParameters);
            return managementGroupOperationsController.deploy();
        }
        else if(taskParameters.deploymentScope === "Subscription") {
            var subscriptionOperationsController = new subscription.Subscription(new armSubscription.SubscriptionManagementClient(taskParameters.credentials, taskParameters.subscriptionId), taskParameters);
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