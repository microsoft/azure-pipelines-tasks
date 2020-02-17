import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import deployAzureRG = require("./models/DeployAzureRG");
import virtualMachine = require("./operations/VirtualMachine");
import resourceGroup = require("./operations/ResourceGroup");

function run(): Promise<void> {
    var azureRGTaskParameters = new deployAzureRG.AzureRGTaskParameters();
    return azureRGTaskParameters.getAzureRGTaskParameters().then((taskParameters) => {
        var resourceGroupOperationsController = new resourceGroup.ResourceGroup(taskParameters);
        var virtualMachineOperation = new virtualMachine.VirtualMachine(taskParameters);
        switch (taskParameters.action) {
            case "Create Or Update Resource Group":
                return resourceGroupOperationsController.createOrUpdateResourceGroup();
            case "DeleteRG":
                return resourceGroupOperationsController.deleteResourceGroup();
            case "Select Resource Group":
                return resourceGroupOperationsController.selectResourceGroup();
            case "Start":
            case "Stop":
            case "Restart":
            case "Delete":
            case "StopWithDeallocate":
                return virtualMachineOperation.execute();
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