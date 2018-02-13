import tl = require("vsts-task-lib/task");
import path = require("path");

import validateInputs = require("./ValidateInputs");
import storageAccount = require("./StorageAccount");
import virtualMachine = require("./VirtualMachine");

function run(): Promise<void> {
    var azureRGTaskParameters = new validateInputs.AzureFileCopyXplatTaskParameters();
    return azureRGTaskParameters.getAzureFileCopyTaskParameters().then((taskParameters) => {
        var storageAccountOperations = new storageAccount.StorageAccount(taskParameters);
        var virtualMachineOperations = new virtualMachine.VirtualMachine(taskParameters);
        switch (taskParameters.action) {
            case "ToAzureBlob":
                return storageAccountOperations.uploadFilesToStorageBlob(taskParameters);
            case "ToAzureVMs":
                return storageAccountOperations.uploadFilesToStorageBlob(taskParameters, taskParameters.sourcePath, taskParameters.containerName).
                    then(storageAccountOperations.uploadScriptsToStorageBlob(taskParameters)).
                    then(virtualMachineOperations.copyFromBlobFilesToVMs(taskParameters)).
                    then(storageAccountOperations.deleteTemporaryContainer(taskParameters));
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
