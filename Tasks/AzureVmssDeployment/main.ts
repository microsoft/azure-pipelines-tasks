import tl = require("vsts-task-lib/task");
import path = require("path");

import AzureVmssTaskParameters from "./models/AzureVmssTaskParameters";
import VirtualMachineScaleSet from "./operations/VirtualMachineScaleSet";

function run(): Promise<void> {
    var taskParameters = new AzureVmssTaskParameters();
    var vmssOperation = new VirtualMachineScaleSet(taskParameters);
    switch (taskParameters.action) {
        case "UpdateImage":
            return vmssOperation.execute();
        default:
            throw tl.loc("InvalidAction", taskParameters.action);
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run().then((result) =>
   tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) =>
    tl.setResult(tl.TaskResult.Failed, error)
);