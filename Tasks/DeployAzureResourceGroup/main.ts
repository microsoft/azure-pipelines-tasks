import tl = require("vsts-task-lib/task");
import path = require("path");

import deployAzureRG = require("./models/DeployAzureRG");
import virtualMachine = require("./operations/VirtualMachine");
import resourceGroup = require("./operations/ResourceGroup");

function run () {
    var taskParameters = new deployAzureRG.AzureRGTaskParameters();
    var resourceGroupOperationsController = new resourceGroup.ResourceGroup(taskParameters);
    var virtualMachineOperationsController = new virtualMachine.VirtualMachine(taskParameters);
    switch (taskParameters.action) {
            case "Create or update resource group": 
                resourceGroupOperationsController.createOrUpdateResourceGroup();
                break;
            case "DeleteRG":
                resourceGroupOperationsController.deleteResourceGroup();
                break;
            case "Select resource group":
                resourceGroupOperationsController.selectResourceGroup();
                break;
            case "Start":
            case "Stop":
            case "Restart":
            case "Delete":
                virtualMachineOperationsController.execute();
                break;
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidAction", taskParameters.action));
                process.exit();
    }
}

try {
    tl.setResourcePath(path.join( __dirname, "task.json"));
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("TaskNotFound", err));
    process.exit();
}

run();