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

function run () {
    var taskParameters = new deployAzureRG.AzureRGTaskParameters();
    var resourceGroupOperationsController = new resourceGroup.ResourceGroup(taskParameters);
    var virtualMachineOperationsController = new virtualMachine.VirtualMachine(taskParameters);
    switch (taskParameters.action) {
            case "Create or update resource group": 
                resourceGroupOperationsController.createOrUpdateRG();
                virtualMachineOperationsController.execute();
                break;
            case "DeleteRG":
                virtualMachineOperationsController.execute();
                resourceGroupOperationsController.deleteResourceGroup();
                break;
            case "Select resource group":
                resourceGroupOperationsController.selectResourceGroup();
                virtualMachineOperationsController.execute();
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("selectResourceGroupSuccessfull", taskParameters.resourceGroupName, taskParameters.outputVariable))
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
}

run();