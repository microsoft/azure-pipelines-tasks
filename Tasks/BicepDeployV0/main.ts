import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { parseConfig, execute } from '@azure/bicep-deploy-common';
import { TaskInputParameterNames, TaskInputReader, TaskOutputSetter } from './taskIO';
import { TaskLogger, errorMessageConfig, loggingMessageConfig } from './logging';
import { AzureAuthenticationHelper } from './auth';

export async function run(): Promise<void> {
    const authHelper = new AzureAuthenticationHelper();

    try {
        const connectedService: string = tl.getInput('ConnectedServiceName', true);

        const inputReader = new TaskInputReader();
        const inputParameterNames = new TaskInputParameterNames();
        const logger = new TaskLogger();
        const outputSetter = new TaskOutputSetter();

        // Parse and validate configuration before Azure login (fail fast)
        const config = parseConfig(inputReader, inputParameterNames);

        // Login to Azure after validation passes
        await authHelper.loginAzure(connectedService);

        // Execute the deployment or deployment stack operation
        await execute(config, logger, outputSetter, errorMessageConfig, loggingMessageConfig);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('OperationSucceeded'));
    } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    } finally {
        authHelper.logoutAzure();
    }
}

tl.setResourcePath(path.join(__dirname, 'task.json'));
run();
