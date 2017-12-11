import { setTimeout } from 'timers';
import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');

import { 
    AzureEndpoint,
    AzureAppServiceConfigurationDetails
} from './azureModels';
import { KuduServiceManagementClient } from './azure-arm-app-service-kudu';

export class Kudu {
    private kuduServiceManagementClient: KuduServiceManagementClient;
    private _scmUri: string;
    private _username: string;
    private _password: string;

    constructor(scmUri: string, username: string, password: string) {
        this._scmUri = scmUri;
        this._username = username;
        this._password = password;
        var base64EncodedCredential = (new Buffer(username + ':' + password).toString('base64'));
        this.kuduServiceManagementClient = new KuduServiceManagementClient(scmUri, base64EncodedCredential);
    }

    public async updateDeployment(isSucceeded: boolean, deploymentID?: string, customMessage?: any) {
        var defer = Q.defer<string>();
        var deploymentStatusBody = this._getUpdateHistoryRequest(isSucceeded, deploymentID, customMessage);
        this.kuduServiceManagementClient.kuduService.updateDeployment(deploymentStatusBody.id, deploymentStatusBody, null, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToUpdateDeploymentHistory', this.error(error)));
            }
            else {
                console.log(tl.loc("Successfullyupdateddeploymenthistory", result.url));
                defer.resolve(result.id);
            }
        });

        return defer.promise;
    }

    
    public async getContinuousJobs() {
        var defer = Q.defer<any>();
        this.kuduServiceManagementClient.kuduService.getContinuousJobs((error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToGetContinuousWebJobs', this.error(error)));
            }
            else {
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async startContinuousWebJob(jobName: string) {
        var defer = Q.defer<any>();
        tl.debug(`Starting Web job: ${jobName}.`);
        this.kuduServiceManagementClient.kuduService.startContinuousJob(jobName, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToStartContinuousWebJob', jobName, this.error(error)));
            }
            else {
                tl.debug(`Started Web job: ${jobName}. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async stopContinuousWebJob(jobName: string) {
        var defer = Q.defer<any>();
        tl.debug(`Stopping Web job: ${jobName}.`);
        this.kuduServiceManagementClient.kuduService.stopContinuousJob(jobName, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToStopContinuousWebJob', jobName, this.error(error)));
            }
            else {
                tl.debug(`stopped Web job: ${jobName}. Result: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async installSiteExtension(extensionName: string) {
        var defer = Q.defer<any>();
        console.log(tl.loc("InstallingSiteExtension", extensionName));
        this.kuduServiceManagementClient.kuduService.installSiteExtension(extensionName, (error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToInstallSiteExtension', this.error(error)));
            }
            else {
                console.log(tl.loc('SiteExtensionInstalled', extensionName));
                defer.resolve(result);
            }
        });

        return defer.promise;
    }

    public async getSiteExtensions() {
        var defer = Q.defer<any>();
        this.kuduServiceManagementClient.kuduService.getSiteExtensions((error, result, request, response) => {
            if(error) {
                defer.reject(tl.loc('FailedToGetSiteExtensions', this.error(error)));
            }
            else {
                tl.debug(`Retrieved site extensions. Data: ${JSON.stringify(result)}`);
                defer.resolve(result);
            }
        });

        return defer.promise;
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

        return anyExtensionInstalled;
    }

    public async startContinuousWebJobs() {
        var webJobs = await this.getContinuousJobs();
        for(var webJob of webJobs) {
            await this.startContinuousWebJob(webJob.name);
        }
    }

    public async stopContinuousWebJobs() {
        var webJobs = await this.getContinuousJobs();
        for(var webJob of webJobs) {
            await this.stopContinuousWebJob(webJob.name);
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
        deploymentID = !!deploymentID ? deploymentID : (buildId ? buildId : releaseId) + Date.now().toString();
    
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

    private error(error: any) {
        if(error && error.message) {
            if(error.statusCode) {
                error.message = `${typeof error.message.valueOf == 'string' ? error.message : error.message.Code + " - " + error.message.Message } (CODE: ${error.statusCode})`
            }

            return error.message;
        }

        return error;
    }
}
