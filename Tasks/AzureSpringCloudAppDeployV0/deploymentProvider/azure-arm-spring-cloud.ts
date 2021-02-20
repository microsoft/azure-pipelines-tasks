
import tl = require('azure-pipelines-task-lib/task');
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient';
import { ShareFileClient, AnonymousCredential } from '@azure/storage-file-share';
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase';
import constants = require('azure-pipelines-tasks-azure-arm-rest-v2/constants');


class DeploymentTarget {
    private _sasUrl: string;
    private _relativePath: string;

    constructor(sasUrl: string, relativePath: string) {
        this._sasUrl = sasUrl;
        this._relativePath = relativePath;
    }


    public get sasUrl(): string {
        return this._sasUrl;
    }


    public get relativePath(): string {
        return this._relativePath;
    }


}

export class AzureSpringCloud {
    private _resourceId: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceId: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceId = resourceId;
    }

    /* Parses the environment variable string in the form "-key value"
     */
    public static parseEnvironmentVariables(environmentVariables?: string): object {
        if (!environmentVariables) {
            return {};
        }

        var result = {};

        var insideQuotes = false;
        var curKey = '';
        var curValue = '';
        var readingKey = true;
        for (var i = 0; i < environmentVariables.length; ++i) {
            if (readingKey) {
                switch (environmentVariables[i]) {
                    case '-':
                        if (i > 0 && environmentVariables[i - 1] != ' ') {
                            curKey += environmentVariables[i];
                        }
                        break;
                    case ' ':
                        if (i > 0 && environmentVariables[i - 1] != ' ') {
                            readingKey = false;
                        }
                        break;
                    default:
                        curKey += environmentVariables[i];
                }
            } else { //Reading the value
                if (!insideQuotes) {
                    switch (environmentVariables[i]) {
                        case ' ':
                            if (i > 0 && environmentVariables[i - 1] != ' ') {
                                result[curKey] = curValue;
                                readingKey = true;
                                curKey = '';
                                curValue = '';
                            }
                            break;
                        case '"':
                            insideQuotes = true;
                            break;
                        default: curValue += environmentVariables[i];
                    }
                } else { //If we're inside quotation marks
                    if (environmentVariables[i] == '"') {
                        insideQuotes = false;
                    } else {
                        curValue += environmentVariables[i];
                    }
                }
            }
        }

        if (curKey && curValue) {
            result[curKey] = curValue;
        }

        return result;
    }

    public async deployJar(artifactToUpload: string, appName: string, deploymentName: string, jvmOptions?: string, environmentVariables?: string): Promise<void> {
        //Get deployment URL
        const deploymentTarget = await this.getDeploymenTarget(appName, deploymentName);
        await this.uploadToSasUrl(deploymentTarget.sasUrl, artifactToUpload);
        await this.updateApp(appName, deploymentTarget.relativePath, deploymentName, jvmOptions, environmentVariables);
    }


    protected async getDeploymenTarget(appName: string, deploymentName?: string): Promise<DeploymentTarget> {
     
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/getResourceUploadUrl`, {
            '{appName}': appName
        }, null, '2019-05-01-preview');
        tl.debug('Request URI:' + httpRequest.uri);
        var response = await this._client.beginRequest(httpRequest);
        if (response.statusCode != 200) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ToError(response);
        }
        console.log('Response:');
        console.log(JSON.stringify(response.body));
        return new DeploymentTarget(response.body.uploadUrl, response.body.relativePath);
    }

    private async uploadToSasUrl(sasUrl: string, localPath: string) {
        console.log('uploading to URL: ' + sasUrl);
        const shareServiceClient = new ShareFileClient(sasUrl, new AnonymousCredential());
        try {
            console.info(`Starting upload of ${localPath}`);
            await shareServiceClient.uploadFile(localPath, {
                onProgress: (ev) => console.log(ev)
            });
            console.info(`upload of ${localPath} completed`);
        } catch (err) {
            console.error(`Upload of ${localPath} failed`, err);
            throw err;
        }
    }

    private async updateApp(appName: string, resourcePath: string, deploymentName: string, jvmOptions?: string, environmentVariables?: string): Promise<void> {
        console.log(`Updating ${appName}, deployment ${deploymentName}...`)

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PATCH';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments/{deploymentName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, '2020-07-01');

        //Apply deployment settings and environment variables
        var deploymentSettings = {};
        if (jvmOptions) {
            tl.debug("JVM Options modified.");
            deploymentSettings['jvmOptions'] = jvmOptions;
        }
        if (environmentVariables) {
            tl.debug("Environment variables modified.");
            deploymentSettings['environmentVariables'] = AzureSpringCloud.parseEnvironmentVariables(environmentVariables);
        }


        //Build update request body
        httpRequest.body = JSON.stringify({
            properties: {
                source: {
                    relativePath: resourcePath,
                    type: 'Jar'
                },
                deploymentSettings: deploymentSettings
            }
        });


        tl.debug('PATCH Request URI:' + httpRequest.uri);
        var response = await this._client.beginRequest(httpRequest);
        tl.debug('Response: ' + JSON.stringify(response.body));
        if (response.statusCode != 202) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            return Promise.reject(ToError(response));
        }
    }

    private _getFormattedName(): string {
        return `${this._resourceId}`;
    }

}
