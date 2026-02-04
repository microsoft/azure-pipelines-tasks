import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { 
    parseConfig, 
    getTemplateAndParameters, 
    execute 
} from '@azure/bicep-deploy-common';
import { TaskInputParameterNames, TaskInputReader, TaskOutputSetter } from './taskIO';
import { TaskLogger, errorMessageConfig, loggingMessageConfig } from './logging';
import { AzureAuthenticationHelper } from './auth';

export async function run(): Promise<void> {
    const authHelper = new AzureAuthenticationHelper();

    try {
        const connectedService: string = tl.getInput('ConnectedServiceName', true);

        await authHelper.loginAzure(connectedService);

        const inputReader = new TaskInputReader();
        const inputParameterNames = new TaskInputParameterNames();
        const logger = new TaskLogger();
        const outputSetter = new TaskOutputSetter();

        // Parse configuration from task inputs
        const config = parseConfig(inputReader, inputParameterNames);
        logger.logInfo(tl.loc('TaskConfig', JSON.stringify(config, null, 2)));

        // Get template and parameters (skip for delete operations)
        // TODO: Update to use new execute() signature once library is updated.
        let files = {};
        if (config.operation === 'delete') {
            if (config.templateFile || config.parametersFile) {
                logger.logWarning(tl.loc('FilesIgnoredForDelete'));
            }
        } else {
            files = await getTemplateAndParameters(config, logger);
        }

        // Execute the deployment or deployment stack operation
        await execute(config, files, logger, outputSetter, errorMessageConfig, loggingMessageConfig);
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
