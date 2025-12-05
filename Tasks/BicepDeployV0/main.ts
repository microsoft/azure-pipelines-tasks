import tl = require('azure-pipelines-task-lib/task');
import { 
    parseConfig, 
    getTemplateAndParameters, 
    execute 
} from '@azure/bicep-deploy-common';
import { TaskInputParameterNames, TaskInputReader, TaskOutputSetter } from './taskIO';
import { TaskLogger, errorMessageConfig, loggingMessageConfig } from './logging';

export async function run() {
    try {
        const inputReader = new TaskInputReader();
        const inputParameterNames = new TaskInputParameterNames();
        const logger = new TaskLogger();
        const outputSetter = new TaskOutputSetter();

        // Parse configuration from task inputs
        const config = parseConfig(inputReader, inputParameterNames);
        logger.logInfo(tl.loc('TaskConfig', JSON.stringify(config, null, 2)));

        // Get template and parameters
        const files = await getTemplateAndParameters(config, logger);

        // Execute the deployment or deployment stack operation
        await execute(config, files, logger, outputSetter, errorMessageConfig, loggingMessageConfig);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('OperationSucceeded'));
    } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // tl.error doesn't need to be called separately as setResult calls it internally.
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

run();
