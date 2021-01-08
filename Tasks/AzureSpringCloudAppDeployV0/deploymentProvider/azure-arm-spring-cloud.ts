import tl = require('azure-pipelines-task-lib/task');
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient';
import { ShareFileClient, FileParallelUploadOptions, AnonymousCredential } from "@azure/storage-file-share";
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase';
import constants = require('azure-pipelines-tasks-azure-arm-rest-v2/constants');
 


export class AzureSpringCloud {
    private _resourceId: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceId: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceId = this._resourceId
    }

    public async deployJar(artifactToUpload: string, appName: string, deploymentName?: string): Promise<void> {
        //Get deployment URL
        const deploymentUrl = await this.getDeploymentUrl(appName, deploymentName);
        await this.uploadToSasUrl(deploymentUrl, artifactToUpload);
    }

    protected async getDeploymentUrl(appName: string, deploymentName?: string): Promise<string> {

        try {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/getResourceUploadUrl`, {
                appName
            }, null, '2019-05-01-preview');
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200) {
                throw ToError(response);
            }
            return response.body;

        } catch (error) {
            throw Error(tl.loc('UnableToGetDeploymentUrl', this._getFormattedName(), this._client.getFormattedError(error)));
        }
    }

    private async uploadToSasUrl(sasUrl: string, localPath: string) {

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