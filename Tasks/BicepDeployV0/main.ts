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
        // Setup environment variables for Azure SDK authentication.
        // The @azure/bicep-deploy-common library uses ChainedTokenCredential which tries:
        // 1. EnvironmentCredential (reads AZURE_* env vars)
        // 2. AzureCliCredential (falls back to Azure CLI if installed)
        // 3. AzurePowerShellCredential (falls back to Azure PowerShell if installed)
        const connectedServiceName = tl.getInput('ConnectedServiceName', true);
        const authScheme = tl.getEndpointAuthorizationScheme(connectedServiceName, true);

        if (authScheme.toLowerCase() === 'serviceprincipal') {
            // Traditional service principal with client secret
            process.env.AZURE_CLIENT_ID = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalid', false);
            process.env.AZURE_CLIENT_SECRET = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalkey', false);
            process.env.AZURE_TENANT_ID = tl.getEndpointAuthorizationParameter(connectedServiceName, 'tenantid', false);
            tl.debug('Using ServicePrincipal authentication with client secret');
        } else {
            throw new Error(tl.loc('UnsupportedAuthScheme', authScheme));
        }

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
