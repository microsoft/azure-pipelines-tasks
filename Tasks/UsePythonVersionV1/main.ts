import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry'
import { getPlatform } from './taskutil';
import { usePythonVersion } from './usepythonversion';

/**
 * Gets the GitHub token from the service connection.
 * Supports 'OAuth', 'OAuth2', 'PersonalAccessToken', 'InstallationToken', and 'Token' authentication schemes.
 * @param endpointId The service connection endpoint ID
 * @returns The GitHub token
 */
function getGithubTokenFromServiceConnection(endpointId: string): string {
    const githubEndpointObject = task.getEndpointAuthorization(endpointId, false);
    let githubEndpointToken: string = null;

    if (!!githubEndpointObject) {
        task.debug("Endpoint scheme: " + githubEndpointObject.scheme);

        if (githubEndpointObject.scheme === 'PersonalAccessToken') {
            githubEndpointToken = githubEndpointObject.parameters.accessToken;
        } else if (githubEndpointObject.scheme === 'OAuth' || githubEndpointObject.scheme === 'OAuth2') {
            githubEndpointToken = githubEndpointObject.parameters.AccessToken;
        } else if (githubEndpointObject.scheme === 'Token') {
            githubEndpointToken = githubEndpointObject.parameters.AccessToken;
        } else if (githubEndpointObject.scheme === 'InstallationToken') {
            githubEndpointToken = githubEndpointObject.parameters.IdToken;
        } else if (githubEndpointObject.scheme) {
            throw new Error(task.loc('AuthSchemeNotSupported', githubEndpointObject.scheme));
        }
    }

    if (!githubEndpointToken) {
        throw new Error(task.loc('ServiceEndpointNotDefined'));
    }

    return githubEndpointToken;
}

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        const versionSpec = task.getInput('versionSpec', true);
        const disableDownloadFromRegistry = task.getBoolInput('disableDownloadFromRegistry');
        const allowUnstable = task.getBoolInput('allowUnstable');
        const addToPath = task.getBoolInput('addToPath', true);
        const architecture = task.getInput('architecture', true);

        // Determine the GitHub token based on the authentication type
        let githubToken: string | undefined;
        const githubTokenAuthType = task.getInput('githubTokenAuthType', false) || 'token';

        if (!disableDownloadFromRegistry) {
            if (githubTokenAuthType === 'serviceConnection') {
                const githubServiceConnection = task.getInput('githubServiceConnection', false);
                if (githubServiceConnection) {
                    githubToken = getGithubTokenFromServiceConnection(githubServiceConnection);
                }
            } else {
                // Default to token-based authentication (same as V0)
                githubToken = task.getInput('githubToken', false);
            }
        }

        await usePythonVersion({
            versionSpec,
            allowUnstable,
            disableDownloadFromRegistry,
            addToPath,
            architecture,
            githubToken
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
        telemetry.emitTelemetry('TaskHub', 'UsePythonVersionV1', {
            versionSpec,
            addToPath,
            architecture,
            githubTokenAuthType
        });
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
