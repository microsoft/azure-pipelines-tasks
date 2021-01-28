console.log('3aA1');
import tl = require('azure-pipelines-task-lib/task');
console.log('3aA2');
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
console.log('3aA3');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
console.log('3aA4');
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient';
console.log('3aA5');
import { ShareFileClient, AnonymousCredential } from '@azure/storage-file-share';
console.log('3aA6');
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase';
console.log('3aA7');
import constants = require('azure-pipelines-tasks-azure-arm-rest-v2/constants');
console.log('3aA8');


export class AzureSpringCloud {
    private _resourceId: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceId: string) {
        console.log('3aA8.2');
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceId = resourceId;
        console.log('3aA8.3');
    }

    public async deployJar(artifactToUpload: string, appName: string, deploymentName?: string): Promise<void> {
        console.log('3aA9');
        //Get deployment URL
        const deploymentUrl = await this.getDeploymentUrl(appName, deploymentName);
        await this.uploadToSasUrl(deploymentUrl, artifactToUpload);
    }

    protected async getDeploymentUrl(appName: string, deploymentName?: string): Promise<string> {
        console.log('3aA10');
        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'POST';
            httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/getResourceUploadUrl`, {
                '{appName}': appName
            }, null, '2019-05-01-preview');
            console.log('Request URI:' + httpRequest.uri);
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200) {
                console.log('Error code: '+response.statusCode);
                console.log(response.statusMessage);
                throw ToError(response);
            }
            console.log('Response:');
            console.log(JSON.stringify(response.body));
            return response.body.uploadUrl;

        } catch (error) {
            throw Error(tl.loc('UnableToGetDeploymentUrl', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private async uploadToSasUrl(sasUrl: string, localPath: string) {
        console.log('uploading to URL: '+sasUrl);
        const shareServiceClient = new ShareFileClient(sasUrl, new AnonymousCredential());
        try {
            console.info(`Starting upload of ${localPath}`);
            await shareServiceClient.uploadFile(localPath, {
                onProgress: (ev) => console.log(ev)
            });
            console.info(`upload of ${localPath} completed`);
        } catch (err) {
            console.error(`Upload of ${localPath} failed`, err);
            throw ('Upload failure');
        }
    }

    private _getFormattedName(): string {
        return `${this._resourceId}`;
    }
}
console.log('3aA8.1');