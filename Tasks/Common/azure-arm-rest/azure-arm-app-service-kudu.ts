import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import util = require('util');
import webClient = require('./webClient');
import Q = require('q');
import { ToError } from './AzureServiceClient';
import { WebJob, SiteExtension } from './azureModels';

export class KuduServiceManagementClient {
    private _scmUri;
    private _accesssToken: string;

    constructor(scmUri: string, accessToken: string) {
        this._accesssToken = accessToken;
        this._scmUri = scmUri;
    }

    public async beginRequest(request: webClient.WebRequest, reqOptions?: webClient.WebRequestOptions): Promise<webClient.WebResponse> {
        request.headers = request.headers || {};
        request.headers["Authorization"] = "Basic " + this._accesssToken;
        request.headers['Content-Type'] = 'application/json; charset=utf-8';
        var options: webClient.WebRequestOptions = {
            retryIntervalInSeconds: reqOptions && reqOptions.retryIntervalInSeconds ? reqOptions.retryIntervalInSeconds :  10,
            retryCount: reqOptions && reqOptions.retryCount ? reqOptions.retryCount : 6,
            retriableErrorCodes: reqOptions && reqOptions.retriableErrorCodes ? reqOptions.retriableErrorCodes : ["ETIMEDOUT"],
            retriableStatusCodes: reqOptions && reqOptions.retriableStatusCodes ? reqOptions.retriableStatusCodes :  [409, 500, 502, 503, 504]
        };
        
        var httpResponse = webClient.sendRequest(request, options);
        return httpResponse;
    }

    public getRequestUri(uriFormat: string) {
        uriFormat = uriFormat[0] == "/" ? uriFormat : "/" + uriFormat;
        return this._scmUri + uriFormat;
    }

    public getScmUri(): string {
        return this._scmUri;
    }
}

export class Kudu {
    private _client: KuduServiceManagementClient;

    constructor(scmUri: string, username: string, password: string) {
        var base64EncodedCredential = (new Buffer(username + ':' + password).toString('base64'));
        this._client = new KuduServiceManagementClient(scmUri, base64EncodedCredential);
    }

    public async updateDeployment(requestBody: any): Promise<any> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(requestBody);
        httpRequest.uri = this._client.getRequestUri(`/api/deployments/${requestBody.id}`);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`updateDeployment. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                console.log(tl.loc("Successfullyupdateddeploymenthistory", response.body.url));
                return response.body.id;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToUpdateDeploymentHistory', this._getFormattedError(error)));
        }
    }

    public async getContinuousJobs(): Promise<Array<WebJob>> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs`);
        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`getContinuousJobs. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                return response.body as Array<WebJob>;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetContinuousWebJobs', this._getFormattedError(error)))
        }
    }

    public async startContinuousWebJob(jobName: string): Promise<WebJob> {
        console.log(tl.loc('StartingWebJob', jobName));
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs/${jobName}/start`);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`startContinuousWebJob. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                console.log(tl.loc('StartedWebJob', jobName));
                return response.body as WebJob;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToStartContinuousWebJob', jobName, this._getFormattedError(error)));
        }
    }

    public async stopContinuousWebJob(jobName: string): Promise<WebJob> {
        console.log(tl.loc('StoppingWebJob', jobName));
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs/${jobName}/stop`);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`stopContinuousWebJob. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                console.log(tl.loc('StoppedWebJob', jobName));
                return response.body as WebJob;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToStopContinuousWebJob', jobName, this._getFormattedError(error)));
        }
    }

    public async installSiteExtension(extensionID: string): Promise<SiteExtension> {
        console.log(tl.loc("InstallingSiteExtension", extensionID));
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(`/api/siteextensions/${extensionID}`);
        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`installSiteExtension. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                console.log(tl.loc("SiteExtensionInstalled", extensionID));
                return response.body;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToInstallSiteExtension', extensionID, this._getFormattedError(error)))
        }
    }

    public async getSiteExtensions(): Promise<Array<SiteExtension>> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/siteextensions`);
        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`getSiteExtensions. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                return response.body as Array<SiteExtension>;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetSiteExtensions', this._getFormattedError(error)))
        }
    }

    public async getProcess(processID: number): Promise<any> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/processes/${processID}`);
        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`getProcess. status code: ${response.statusCode} - ${response.statusMessage}`);
            if(response.statusCode == 200) {
                return response.body;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetProcess', this._getFormattedError(error)))
        }
    }

    public async killProcess(processID: number): Promise<void> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this._client.getRequestUri(`/api/processes/${processID}`);
        try {
            var response = await this._client.beginRequest(httpRequest, {
                retriableErrorCodes: ["ETIMEDOUT"],
                retriableStatusCodes: [503],
                retryCount: 1,
                retryIntervalInSeconds: 5
            });
            tl.debug(`killProcess. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 502) {
                tl.debug(`Killed Process ${processID}`);
                return;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToKillProcess', this._getFormattedError(error)))
        }
    }

    public async getAppSettings(): Promise<Map<string, string>> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/settings`);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`getAppSettings. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                return response.body;
            }

            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToFetchKuduAppSettings', this._getFormattedError(error)));
        }
    }

    public async listDir(physicalPath: string): Promise<void> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/vfs/${physicalPath}/`);
        httpRequest.headers = {
            'If-Match': '*'
        };

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`listFiles. Data: ${JSON.stringify(response)}`);
            if([200, 201, 204].indexOf(response.statusCode) != -1) {
                return response.body;
            }
            else if(response.statusCode === 404) {
                return null;
            }
            else {
                throw response;
            }
        }
        catch(error) {
            throw Error(tl.loc('FailedToListPath', physicalPath, this._getFormattedError(error)));
        }
    }

    public async getFileContent(physicalPath: string, fileName: string): Promise<string> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/vfs/${physicalPath}/${fileName}`);
        httpRequest.headers = {
            'If-Match': '*'
        };

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`getFileContent. Data: ${JSON.stringify(response)}`);
            if([200, 201, 204].indexOf(response.statusCode) != -1) {
                return response.body;
            }
            else if(response.statusCode === 404) {
                return null;
            }
            else {
                throw response;
            }
        }
        catch(error) {
            throw Error(tl.loc('FailedToGetFileContent', physicalPath, fileName, this._getFormattedError(error)));
        }
    }

    public async uploadFile(physicalPath: string, fileName: string, filePath: string): Promise<void> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        if(!tl.exist(filePath)) {
            throw new Error(tl.loc('FilePathInvalid', filePath));
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(`/api/vfs/${physicalPath}/${fileName}`);
        httpRequest.headers = {
            'If-Match': '*'
        };
        httpRequest.body = fs.createReadStream(filePath);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`uploadFile. Data: ${JSON.stringify(response)}`);
            if([200, 201, 204].indexOf(response.statusCode) != -1) {
                return response.body;
            }
            
            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToUploadFile', physicalPath, fileName, this._getFormattedError(error)));
        }
    }

    public async createPath(physicalPath: string): Promise<any> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(`/api/vfs/${physicalPath}/`);
        httpRequest.headers = {
            'If-Match': '*'
        };

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`createPath. Data: ${JSON.stringify(response)}`);
            if([200, 201, 204].indexOf(response.statusCode) != -1) {
                return response.body;
            }
            
            throw response;
        }
        catch(error) {
            throw Error(tl.loc('FailedToCreatePath', physicalPath, this._getFormattedError(error)));
        }
    }

    public async runCommand(physicalPath: string, command: string): Promise<void> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`/api/command`);
        httpRequest.headers = {
            'Content-Type': 'multipart/form-data',
            'If-Match': '*'
        };
        httpRequest.body = JSON.stringify({
            'command': command,
            'dir': physicalPath
        });

        try {
            tl.debug('Executing Script on Kudu. Command: ' + command);
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`runCommand. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                return ;
            }
            else {
                throw response;
            }
        }
        catch(error) {
            throw Error(error.toString());
        }
    }

    public async extractZIP(webPackage: string, physicalPath: string): Promise<void> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(`/api/zip/${physicalPath}/`);
        httpRequest.headers = {
            'Content-Type': 'multipart/form-data',
            'If-Match': '*'
        };
        httpRequest.body = fs.createReadStream(webPackage);

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`extractZIP. Data: ${JSON.stringify(response)}`);
            if(response.statusCode == 200) {
                return ;
            }
            else {
                throw response;
            }
        }
        catch(error) {
            throw Error(tl.loc('Failedtodeploywebapppackageusingkuduservice', this._getFormattedError(error)));
        }
    }

    public async deleteFile(physicalPath: string, fileName: string): Promise<void> {
        physicalPath = physicalPath.replace(/[\\]/g, "/");
        physicalPath = physicalPath[0] == "/" ? physicalPath.slice(1): physicalPath;
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this._client.getRequestUri(`/api/vfs/${physicalPath}/${fileName}`);
        httpRequest.headers = {
            'If-Match': '*'
        };

        try {
            var response = await this._client.beginRequest(httpRequest);
            tl.debug(`deleteFile. Data: ${JSON.stringify(response)}`);
            if([200, 201, 204, 404].indexOf(response.statusCode) != -1) {
                return ;
            }
            else {
                throw response;
            }
        }
        catch(error) {
            throw Error(tl.loc('FailedToDeleteFile', physicalPath, fileName, this._getFormattedError(error)));
        }
    }

    private _getFormattedError(error: any) {
        if(error && error.statusCode) {
            return `${error.statusMessage} (CODE: ${error.statusCode})`;
        }
        else if(error && error.message) {
            if(error.statusCode) {
                error.message = `${typeof error.message.valueOf() == 'string' ? error.message : error.message.Code + " - " + error.message.Message } (CODE: ${error.statusCode})`
            }

            return error.message;
        }

        return error;
    }
}