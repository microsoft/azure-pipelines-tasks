import tl = require("vsts-task-lib/task");
import path = require("path");

import validateInputs = require("./ValidateInputs");
import storageAccount = require("./StorageAccount");
import vrtualMachine = require("./VirtualMachine");

function run(): Promise<void> {
    var azureRGTaskParameters = new validateInputs.AzureFileCopyXplatTaskParameters();
    return azureRGTaskParameters.getAzureFileCopyTaskParameters().then((taskParameters) => {
        var storageAccountOperations = new storageAccount.StorageAccount(taskParameters);
        var virtualMachineOperations = new vrtualMachine.VirtualMachine(taskParameters);
        switch (taskParameters.action) {
            case "ToAzureBlob":
                return storageAccountOperations.uploadFilesToStorageBlob(taskParameters);
            case "ToAzureVMs":
                return storageAccountOperations.uploadFilesToStorageBlob(taskParameters).
                then(virtualMachineOperations.copyFromBlobFilesToVMs(taskParameters));
            case "FromAzureBlob":
                return storageAccountOperations.downloadFilesFromStorageBlob(taskParameters);
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