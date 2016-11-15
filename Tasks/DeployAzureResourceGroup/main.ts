import tl = require("vsts-task-lib/task");
import path = require("path");

import deployAzureRG = require("./DeployAzureRG");
import virtualMachine = require("./VirtualMachine");
import resourceGroup = require("./ResourceGroup");

try {
    tl.setResourcePath(path.join( __dirname, "task.json"));
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("TaskNotFound", err));
    process.exit();
}

var taskParameters = new deployAzureRG.AzureRGTaskParameters();
var resourceGroupOperationsController = new resourceGroup.ResourceGroup(taskParameters);
var virtualMachineOperationsController = new virtualMachine.VirtualMachine(taskParameters);

switch (taskParameters.action) {
        case "Create Or Update Resource Group": 
            resourceGroupOperationsController.createOrUpdateRG();
            break;
        case "DeleteRG":
            resourceGroupOperationsController.deleteResourceGroup();
            break;
        case "Select Resource Group":
            resourceGroupOperationsController.selectResourceGroup();
            break;
        case "Start":
        case "Stop":
        case "Restart":
        case "Delete":
            virtualMachineOperationsController.execute();
            break;
        default:
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("InvalidAction"));
            process.exit();
}
