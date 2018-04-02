import tl = require("vsts-task-lib/task");
import path = require("path");

import validateInputs = require("./operations/ValidateInputs");
import storageAccount = require("./operations/StorageAccount");
import virtualMachine = require("./operations/VirtualMachine");

function run(): Promise<void> {
    var azureFCXplatTaskParameters = new validateInputs.AzureFileCopyXplatTaskParameters();
    var storageAccountOperations = new storageAccount.StorageAccount(azureFCXplatTaskParameters);
    var virtualMachineOperations = new virtualMachine.VirtualMachine(azureFCXplatTaskParameters);
    switch (azureFCXplatTaskParameters.action) {
        case "ToAzureBlob":
            return storageAccountOperations.uploadFilesToStorageBlob(azureFCXplatTaskParameters, azureFCXplatTaskParameters.sourcePath, azureFCXplatTaskParameters.containerName);
        case "ToAzureVMs":
            return storageAccountOperations.uploadFilesToStorageBlob(azureFCXplatTaskParameters, azureFCXplatTaskParameters.sourcePath, azureFCXplatTaskParameters.containerName).
                then(() => storageAccountOperations.uploadScriptsToStorageBlob(azureFCXplatTaskParameters)).
                then(() => virtualMachineOperations.copyFromBlobFilesToVMs(azureFCXplatTaskParameters)).
                then(() => storageAccountOperations.deleteTemporaryContainer(azureFCXplatTaskParameters.containerName), 
                    () => storageAccountOperations.deleteTemporaryContainer(azureFCXplatTaskParameters.containerName)).
                then(() => storageAccountOperations.deleteTemporaryContainer(azureFCXplatTaskParameters.containerNameScripts), 
                () => storageAccountOperations.deleteTemporaryContainer(azureFCXplatTaskParameters.containerNameScripts));
        case "FromAzureBlob":
            return storageAccountOperations.downloadFilesFromStorageBlob(azureFCXplatTaskParameters);
    }
}
process.env["AZURE_HTTP_USER_AGENT"] = "VSTS_fefc491f-efa5-497d-a041-f9519fd34d31_release_16_203_203_4"
var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run().then((result) =>
    tl.setResult(tl.TaskResult.Succeeded, "")
).catch((error) =>
    tl.setResult(tl.TaskResult.Failed, error)
    );
