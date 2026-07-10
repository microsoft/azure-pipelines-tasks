import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { parseConfig, execute } from '@azure/bicep-deploy-common';
import { TaskInputParameterNames, TaskInputReader, TaskOutputSetter } from './taskIO';
import { TaskLogger, createErrorMessageConfig, createLoggingMessageConfig } from './logging';
import { AzureAuthenticationHelper } from './auth';
import { TaskBicepCache } from './bicepCache';

tl.setResourcePath(path.join(__dirname, 'task.json'));

export async function run(): Promise<void> {
    const authHelper = new AzureAuthenticationHelper();

    try {
        const connectedService: string = tl.getInput('ConnectedServiceName', true);

        const inputReader = new TaskInputReader();
        const inputParameterNames = new TaskInputParameterNames();
        const logger = new TaskLogger();
        const outputSetter = new TaskOutputSetter();
        const bicepCache = new TaskBicepCache();

        // Parse and validate configuration before Azure login (fail fast)
        const config = parseConfig(inputReader, inputParameterNames);

        // Login to Azure after validation passes
        await authHelper.loginAzure(connectedService);

        // Execute the deployment or deployment stack operation. Build the message
        // configs lazily so tl.loc() runs after tl.setResourcePath() above.
        await execute(
            config,
            logger,
            outputSetter,
            bicepCache,
            createErrorMessageConfig(),
            createLoggingMessageConfig(),
        );
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('OperationSucceeded'));
    } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    } finally {
        authHelper.logoutAzure();
    }
}

run();
