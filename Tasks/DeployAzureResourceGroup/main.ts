import tl = require("vsts-task-lib/task");
import path = require("path");

import deployAzureRG = require("./DeployAzureRG");

try {
    tl.setResourcePath(path.join( __dirname, "task.json"));
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("TaskNotFound", err));
    process.exit();
}

var azureResourceGroupDeployment = new deployAzureRG.AzureResourceGroupDeployment();
azureResourceGroupDeployment.execute();
