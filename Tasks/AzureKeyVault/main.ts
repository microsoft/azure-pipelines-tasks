import tl = require("vsts-task-lib/task");
import path = require("path");

import keyVaultTaskParameters = require("./models/KeyVaultTaskParameters");
import keyVault = require("./operations/KeyVault");

async function run(): Promise<void> {

    try {
        var taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);

        var secretsToErrorsMap = new keyVault.SecretsToErrorsMapping();
        var taskParameters = new keyVaultTaskParameters.KeyVaultTaskParameters();

        var KeyVaultController = new keyVault.KeyVault(taskParameters);
        await KeyVaultController.downloadSecrets(secretsToErrorsMap);

        if (!secretsToErrorsMap.isEmpty()) {
            tl.setResult(tl.TaskResult.Failed, secretsToErrorsMap.getAllErrors());
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, "");
        }
    }
    catch(error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

run();