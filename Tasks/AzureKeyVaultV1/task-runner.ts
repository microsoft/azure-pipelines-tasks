import tl = require("azure-pipelines-task-lib/task");
import { ServiceClient } from "azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient";
import path = require("path");

import { KeyVaultTaskParameters } from "./models/KeyVaultTaskParameters";
import { KeyVault } from "./operations/KeyVault";
import { KeyVaultClient } from "./operations/azure-arm-keyvault";

export class TaskRunner
{
    public static async runInContext(isPreJobContext: boolean): Promise<void>
    {
        const runAsPreJob: boolean = tl.getBoolInput('RunAsPreJob', true);
        if (runAsPreJob === isPreJobContext)
        {
            await this.run();
        }
        else
        {
            tl.setResult(tl.TaskResult.Skipped, "Skipped according to the task's configuration. RunAsPreJob: " + runAsPreJob);
        }
    }

    private static async run(): Promise<void>
    {
        try
        {
            const taskManifestPath = path.join(__dirname, "task.json");
            tl.debug("Setting resource path to " + taskManifestPath);
            tl.setResourcePath(taskManifestPath);

            const taskParameters = await new KeyVaultTaskParameters().getKeyVaultTaskParameters();

            const serviceClient = new ServiceClient(taskParameters.vaultCredentials, taskParameters.subscriptionId);
            const keyVaultClient = new KeyVaultClient(serviceClient, taskParameters.keyVaultUrl);
            const KeyVaultController = new KeyVault(taskParameters, keyVaultClient);
            const secretsToErrorsMap = await KeyVaultController.downloadSecrets();

            if (!secretsToErrorsMap.isEmpty())
            {
                tl.setResult(tl.TaskResult.Failed, secretsToErrorsMap.getAllErrors());
            }
            else
            {
                tl.setResult(tl.TaskResult.Succeeded, "");
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }
}