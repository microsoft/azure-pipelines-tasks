import tl = require('vsts-task-lib/task');
import { Kudu } from '../azure-arm-rest/azure-arm-app-service-kudu';
import { KUDU_DEPLOYMENT_CONSTANTS } from '../azure-arm-rest/constants';
import webClient = require('../azure-arm-rest/webClient');

export class KuduServiceUtility {
    private _appServiceKuduService: Kudu;
    private _deploymentID: string;

    constructor(kuduService: Kudu) {
        this._appServiceKuduService = kuduService;
    }

    public async createPathIfRequired(phsyicalPath: string): Promise<void> {
        var listDir = await this._appServiceKuduService.listDir(phsyicalPath);
        if(listDir == null) {
            await this._appServiceKuduService.createPath(phsyicalPath);
        }
    }

    public async updateDeploymentStatus(taskResult: boolean, DeploymentID: string, customMessage: any): Promise<string> {
        try {
            let requestBody = this._getUpdateHistoryRequest(taskResult, DeploymentID, customMessage);
            return await this._appServiceKuduService.updateDeployment(requestBody);
        }
        catch(error) {
            tl.warning(error);
        }
    }

    public getDeploymentID(): string {
        if(this._deploymentID) {
            return this._deploymentID;
        }

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
        var deploymentID: string = (releaseId ? releaseId : buildId) + Date.now().toString();
        return deploymentID;
    }

    public async warmpUp() {
        try {
            tl.debug('warming up Kudu Service');
            await this._appServiceKuduService.getAppSettings();
            tl.debug('warmed up Kudu Service');
        }
        catch(error) {
            tl.debug('Failed to warm-up Kudu: ' + error.toString());
        }
    }
    private async _pollForFile(physicalPath: string, fileName: string, timeOutInMinutes: number): Promise<void> {
        var attempts: number = 0;
        const retryInterval: number = 10;
        if(tl.getVariable('appservicedeploy.retrytimeout')) {
            timeOutInMinutes = Number(tl.getVariable('appservicedeploy.retrytimeout'));
            tl.debug('Retry timeout in minutes provided by user: ' + timeOutInMinutes);
        }

        var timeOutInSeconds = timeOutInMinutes * 60;
        var noOfRetry = timeOutInSeconds / retryInterval;

        tl.debug(`Polling started for file:  ${fileName} with retry count: ${noOfRetry}`);

        while (attempts < noOfRetry) {
            attempts += 1;
            var fileContent: string = await this._appServiceKuduService.getFileContent(physicalPath, fileName);
            if(fileContent == null) {
                tl.debug('File: ' + fileName + ' not found. retry after 5 seconds. Attempt: ' + attempts);
                await webClient.sleepFor(5);
            }
            else {
                tl.debug('Found file:  ' + fileName);
                return ;
            }
        }

        if(attempts == noOfRetry) {
            throw new Error(tl.loc('PollingForFileTimeOut'));
        }
    }

    private _getUpdateHistoryRequest(isDeploymentSuccess: boolean, deploymentID?: string, customMessage?: any): any {
        
        var status = isDeploymentSuccess ? KUDU_DEPLOYMENT_CONSTANTS.SUCCESS : KUDU_DEPLOYMENT_CONSTANTS.FAILED;
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
        deploymentID = !!deploymentID ? deploymentID : this.getDeploymentID();

        if(releaseUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
        }
        else if(buildUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
        }
    
        var message = {
            type : "deployment",
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

        if(!!customMessage) {
            // Append Custom Messages to original message
            for(var attribute in customMessage) {
                message[attribute] = customMessage[attribute];
            }
            
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
}
