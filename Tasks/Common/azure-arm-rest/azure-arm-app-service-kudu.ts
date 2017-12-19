import msRestAzure = require('./azure-arm-common');
import tl = require('vsts-task-lib/task');
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
            retriableStatusCodes: reqOptions && reqOptions.retriableStatusCodes ? reqOptions.retriableStatusCodes :  [409, 500, 502, 503]
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

    public async updateDeployment(isSucceeded: boolean, deploymentID?: string, customMessage?: any) {
        var deploymentStatusBody = this._getUpdateHistoryRequest(isSucceeded, deploymentID, customMessage);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(deploymentStatusBody);
        httpRequest.uri = this._client.getRequestUri(`/api/deployments/${deploymentStatusBody.id}`);

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

    public async getContinuousJobs(): Promise<Array<WebJob>>{
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

    public async getProcess(processID: number) {
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

    public async killProcess(processID: number) {
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

    public async installSiteExtensions(extensionList: Array<string>, outputVariables?: Array<string>) {
        outputVariables = outputVariables ? outputVariables : [];
        var outputVariableIterator: number = 0;
        var siteExtensions = await this.getSiteExtensions();
        var anyExtensionInstalled: boolean = false;
        var siteExtensionMap = {};
        for(var siteExtension of siteExtensions) {
            siteExtensionMap[siteExtension.id] = siteExtension;
        }

        for(var extensionID of extensionList) {
            var siteExtensionDetails = null;
            if(siteExtensionMap[extensionID]) {
                siteExtensionDetails = siteExtensionMap[extensionID];
                console.log(tl.loc('ExtensionAlreadyInstalled', extensionID));
            }
            else {
                siteExtensionDetails = await this.installSiteExtension(extensionID);
                anyExtensionInstalled = true;
            }

            if(outputVariableIterator < outputVariables.length) {
                var extensionLocalPath: string = this._getExtensionLocalPath(siteExtensionDetails);
                tl.debug('Set output Variable ' + outputVariables[outputVariableIterator] + ' to value: ' + extensionLocalPath);
                tl.setVariable(outputVariables[outputVariableIterator], this._getExtensionLocalPath(siteExtensionDetails));
                outputVariableIterator += 1;
            }
        }
        
        if(anyExtensionInstalled) {
            await this.restart();
        }
    }

    public async restart() {
        try {
            console.log(tl.loc('RestartingKuduService'));
            var process0 = await this.getProcess(0);
            tl.debug(`Process 0 ID: ${process0.id}`);
            await this.killProcess(0);
            await this._pollForNewProcess(0, process0.id);
            console.log(tl.loc('RestartedKuduService'));
        }
        catch(error) {
            throw Error(tl.loc('FailedToRestartKuduService', error.toString()));
        }
    }
    public async startContinuousWebJobs() {
        var webJobs = await this.getContinuousJobs();
        for(var webJob of webJobs) {
            if(webJob.status.toLowerCase() == "running") {
                console.log(tl.loc('WebJobAlreadyInRunningState', webJob.name));
            }
            else {
                await this.startContinuousWebJob(webJob.name);
            }
        }
    }

    public async stopContinuousWebJobs() {
        var webJobs = await this.getContinuousJobs();
        for(var webJob of webJobs) {
            if(webJob.status.toLowerCase() == "stopped") {
                console.log(tl.loc('WebJobAlreadyInStoppedState', webJob.name));
            }
            else {
                await this.stopContinuousWebJob(webJob.name);
            }
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

    private async _pollForNewProcess(processID: number, id: number) {
        var retryCount = 6;
        while(true) {
            try {
                var process = await this.getProcess(processID);
                tl.debug(`process ${processID} ID: ${process.id}`);
                if(process.id != id) {
                    tl.debug(`New Process created`);
                    return process;
                }
            }
            catch(error) {
                tl.debug(`error while polling for process ${processID}: ` + error.toString());
            }
            retryCount -= 1;
            if(retryCount == 0) {
                throw new Error(tl.loc('TimeoutWhileWaiting'));
            }

            tl.debug(`sleep for 10 seconds`)
            await webClient.sleepFor(10);
        }
    }

    private _getUpdateHistoryRequest(isDeploymentSuccess: boolean, deploymentID?: string, customMessage?: any): any {
        
        var status = isDeploymentSuccess ? 4 : 3;
        var author = tl.getVariable('build.sourceVersionAuthor') || tl.getVariable('build.requestedfor') ||
                            tl.getVariable('release.requestedfor') || tl.getVariable('agent.name')
    
        var buildUrl = tl.getVariable('build.buildUri');
        var releaseUrl = tl.getVariable('release.releaseUri');
    
        var buildId = tl.getVariable('build.buildId');
        var releaseId = tl.getVariable('release.releaseId');
        
        var buildNumber = tl.getVariable('build.buildNumber');
        var releaseName = tl.getVariable('release.releaseName');
    
        var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri'); 
        var teamProject = tl.getVariable('system.teamProjectId');
    
         var commitId = tl.getVariable('build.sourceVersion');
         var repoName = tl.getVariable('build.repository.name');
         var repoProvider = tl.getVariable('build.repository.provider');
    
        var buildOrReleaseUrl = "" ;
        deploymentID = !!deploymentID ? deploymentID : (releaseId ? releaseId : buildId) + Date.now().toString();
    
        if(releaseUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
        }
        else if(buildUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
        }
    
        var message = {
            type : customMessage? customMessage.type : "",
            commitId : commitId,
            buildId : buildId,
            releaseId : releaseId,
            buildNumber : buildNumber,
            releaseName : releaseName,
            repoProvider : repoProvider,
            repoName : repoName,
            collectionUrl : collectionUrl,
            teamProject : teamProject
        };
        // Append Custom Messages to original message
        for(var attribute in customMessage) {
            message[attribute] = customMessage[attribute];
        }
    
        var deploymentLogType: string = message['type'];
        var active: boolean = false;
        if(deploymentLogType.toLowerCase() === "deployment" && isDeploymentSuccess) {
            active = true;
        }
    
        return {
            id: deploymentID,
            active : active,
            status : status,
            message : JSON.stringify(message),
            author : author,
            deployer : 'VSTS',
            details : buildOrReleaseUrl
        };
    }    
       
    private _getExtensionLocalPath(extensionInfo: JSON): string {
        var extensionId: string = extensionInfo['id'];
        var homeDir = "D:\\home\\";
    
        if(extensionId.startsWith('python2')) {
            return homeDir + "Python27";
        }
        else if(extensionId.startsWith('python351') || extensionId.startsWith('python352')) {
            return homeDir + "Python35";
        }
        else if(extensionId.startsWith('python3')) {
            return homeDir + extensionId;
        }
        else {
            return extensionInfo['local_path'];
        }
    }
}