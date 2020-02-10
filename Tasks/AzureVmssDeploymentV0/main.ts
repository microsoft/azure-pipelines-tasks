import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import AzureVmssTaskParameters from "./models/AzureVmssTaskParameters";
import VirtualMachineScaleSet from "./operations/VirtualMachineScaleSet";

async function run(): Promise<void> {
    var taskParameters = await new AzureVmssTaskParameters().getAzureVmssTaskParameters();
    var vmssOperation = new VirtualMachineScaleSet(taskParameters);
    await vmssOperation.execute();
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