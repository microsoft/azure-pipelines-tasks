import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

import keyVaultTaskParameters = require("./models/KeyVaultTaskParameters");
import keyVault = require("./operations/KeyVault");

export class TaskRunner {
    public static async runInContext(isPreJobContext: boolean): Promise<void> {
        const runAsPreJob: boolean = tl.getBoolInput('RunAsPreJob', true);
        if (runAsPreJob === isPreJobContext) {
            this.run();
        } else {
            tl.setResult(tl.TaskResult.Skipped, "Skipped according to the task's configuration. RunAsPreJob: " + runAsPreJob);
        }
    }

    private static async run(): Promise<void> {
        try {
            const taskManifestPath = path.join(__dirname, "task.json");
            tl.debug("Setting resource path to " + taskManifestPath);
            tl.setResourcePath(taskManifestPath);

            const secretsToErrorsMap = new keyVault.SecretsToErrorsMapping();
            const vaultParameters = new keyVaultTaskParameters.KeyVaultTaskParameters();
            const taskParameters = await vaultParameters.getKeyVaultTaskParameters();

            const KeyVaultController = new keyVault.KeyVault(taskParameters);
            await KeyVaultController.downloadSecrets(secretsToErrorsMap);

            if (!secretsToErrorsMap.isEmpty()) {
                tl.setResult(tl.TaskResult.Failed, secretsToErrorsMap.getAllErrors());
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, "");
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }
}