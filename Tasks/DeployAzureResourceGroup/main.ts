import tl = require("vsts-task-lib/task");
import path = require("path");

import deployAzureRG = require("./models/DeployAzureRG");
import virtualMachine = require("./operations/VirtualMachine");
import resourceGroup = require("./operations/ResourceGroup");

function run(): Promise<void> {
    var taskParameters = new deployAzureRG.AzureRGTaskParameters();
    var resourceGroupOperationsController = new resourceGroup.ResourceGroup(taskParameters);
    var virtualMachineOperation = new virtualMachine.VirtualMachine(taskParameters);
    switch (taskParameters.action) {
        case "Create or update resource group":
            return resourceGroupOperationsController.createOrUpdateResourceGroup();
        case "DeleteRG":
            return resourceGroupOperationsController.deleteResourceGroup();
        case "Select resource group":
            return resourceGroupOperationsController.selectResourceGroup();
        case "Start":
        case "Stop":
        case "Restart":
        case "Delete":
            return virtualMachineOperation.execute();
        default:
            throw tl.loc("InvalidAction", taskParameters.action);
    }
}

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("TaskNotFound", err));
    process.exit();
}

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) => 
    tl.setResult(tl.TaskResult.Failed, error)
);