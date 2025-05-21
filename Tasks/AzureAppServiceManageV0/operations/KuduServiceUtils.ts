import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');
const pythonExtensionPrefix: string = "azureappservice-";
const extensionVersionSupportEnabled = tl.getBoolFeatureFlag('AzureAppServiceManageV0.ExtensionVersionSupport');

export class KuduServiceUtils {
    private _appServiceKuduService: Kudu;

    constructor(kuduService: Kudu) {
        this._appServiceKuduService = kuduService;
    }

    public async startContinuousWebJobs(): Promise<void> {
        console.log(tl.loc('StartingContinousWebJobs'));
        var webJobs = await this._appServiceKuduService.getContinuousJobs();
        for(var webJob of webJobs) {
            if(webJob.status.toLowerCase() == "running") {
                console.log(tl.loc('WebJobAlreadyInRunningState', webJob.name));
            }
            else {
                await this._appServiceKuduService.startContinuousWebJob(webJob.name);
            }
        }

        console.log(tl.loc('StartedContinousWebJobs'));
    }
    
    public async stopContinuousWebJobs(): Promise<void> {
        console.log(tl.loc('StoppingContinousWebJobs'));
        var webJobs = await this._appServiceKuduService.getContinuousJobs();
        for(var webJob of webJobs) {
            if(webJob.status.toLowerCase() == "stopped") {
                console.log(tl.loc('WebJobAlreadyInStoppedState', webJob.name));
            }
            else {
                await this._appServiceKuduService.stopContinuousWebJob(webJob.name);
            }
        }

        console.log(tl.loc('StoppedContinousWebJobs'));
    }

    public async installSiteExtensions(extensionList: Array<string>, outputVariables?: Array<string>, extensionVersions?: Array<string>): Promise<void> {
        outputVariables = outputVariables ? outputVariables : [];
        extensionVersions = extensionVersions && extensionVersionSupportEnabled ? extensionVersions : [];
        var outputVariableIterator: number = 0;
        var siteExtensions = await this._appServiceKuduService.getSiteExtensions();
        var allSiteExtensions = await this._appServiceKuduService.getAllSiteExtensions();
        var anyExtensionInstalled: boolean = false;
        var siteExtensionMap = {};
        var allSiteExtensionMap = {};
        var extensionLocalPaths: string = "";
        for(var siteExtension of siteExtensions) {
            siteExtensionMap[siteExtension.id] = siteExtension;
        }
        for(var siteExtension of allSiteExtensions) {
            allSiteExtensionMap[siteExtension.id] = siteExtension;
            allSiteExtensionMap[siteExtension.title] = siteExtension;
        }

        for(var i = 0; i < extensionList.length; i++) {
            var extensionID = extensionList[i];
            var version = "";
            var forceUpdate = false;
            
            if (extensionVersionSupportEnabled) {
                // Get version from extensionVersions array if available
                version = (i < extensionVersions.length) ? extensionVersions[i] : "";
                
                // Check if extensionID contains version information in format extensionID(version)
                const parenthesesRegex = /^(.*)\(([^)]*)\)$/;
                const parenthesesMatch = extensionID.match(parenthesesRegex);
                if (parenthesesMatch && parenthesesMatch.length >= 3) {
                    extensionID = parenthesesMatch[1]; // Extension ID
                    version = parenthesesMatch[2] || ""; // Version
                }
                
                // Maintain backwards compatibility for extensionID@version format
                const atSignRegex = /^(.*)@(.*)$/;
                const atSignMatch = extensionID.match(atSignRegex);
                if (atSignMatch && atSignMatch.length >= 3 && !version) {
                    extensionID = atSignMatch[1]; // Extension ID
                    version = atSignMatch[2] || ""; // Version
                }
                
                // If version is 'latest', we force an update even if extension is already installed
                if (version === 'latest') {
                    forceUpdate = true;
                    version = '';
                }
            }
            
            var siteExtensionDetails = null;
            if(allSiteExtensionMap[extensionID] && allSiteExtensionMap[extensionID].title == extensionID) {
                extensionID = allSiteExtensionMap[extensionID].id;
            }
            
            // Python extensions are moved to Nuget and the extensions IDs are changed. The below check ensures that old extensions are mapped to new extension ID.
            if(!forceUpdate && (siteExtensionMap[extensionID] || (extensionID.startsWith('python') && siteExtensionMap[pythonExtensionPrefix + extensionID]))) {
                siteExtensionDetails = siteExtensionMap[extensionID] || siteExtensionMap[pythonExtensionPrefix + extensionID];
                
                // If a specific version is requested and it's different from the installed version, reinstall
                if (extensionVersionSupportEnabled && version && siteExtensionDetails.version !== version) {
                    console.log(tl.loc('InstallingSiteExtension', extensionID));
                    if (version) {
                        console.log(`Installing version: ${version}`);
                    }
                    
                    // Try to pass the version parameter if provided
                    // Note: The underlying Kudu REST API may or may not support versioned installations
                    // depending on the Azure App Service version
                    try {
                        siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID, version);
                    } catch (error) {
                        // If version parameter is not supported, try without it
                        console.log(`Installing extension with version specification failed. Attempting without version specification.`);
                        tl.warning(`Failed to install extension ${extensionID} with version ${version}. Error: ${error.message || JSON.stringify(error)}`);
                        console.log("##vso[telemetry.publish area=TaskInternal;feature=AzureAppServiceManageV0]" + 
                            JSON.stringify({ extensionVersionInstallFailed: true, extensionId: extensionID, version: version }));
                        siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                    }
                    anyExtensionInstalled = true;
                } else {
                    console.log(tl.loc('ExtensionAlreadyInstalled', extensionID));
                    if (siteExtensionDetails.version) {
                        console.log(`Installed version: ${siteExtensionDetails.version}`);
                    }
                }
            }
            else {
                console.log(tl.loc('InstallingSiteExtension', extensionID));
                if (extensionVersionSupportEnabled && version) {
                    console.log(`Installing version: ${version}`);
                }
                
                // Try to pass the version parameter if provided
                // Note: The underlying Kudu REST API may or may not support versioned installations
                // depending on the Azure App Service version
                try {
                    siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID, extensionVersionSupportEnabled ? version : undefined);
                } catch (error) {
                    // If version parameter is not supported, try without it
                    if (extensionVersionSupportEnabled && version) {
                        console.log(`Installing extension with version specification failed. Attempting without version specification.`);
                        tl.warning(`Failed to install extension ${extensionID} with version ${version}. Error: ${error.message || JSON.stringify(error)}`);
                        console.log("##vso[telemetry.publish area=TaskInternal;feature=AzureAppServiceManageV0]" + 
                            JSON.stringify({ extensionVersionInstallFailed: true, extensionId: extensionID, version: version }));
                        siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                    } else {
                        throw error;
                    }
                }
            anyExtensionInstalled = true;
            }
            
            var extensionLocalPath: string = this._getExtensionLocalPath(siteExtensionDetails);
            extensionLocalPaths += extensionLocalPath + ",";
            if(outputVariableIterator < outputVariables.length) {
                tl.debug('Set output Variable ' + outputVariables[outputVariableIterator] + ' to value: ' + extensionLocalPath);
                tl.setVariable(outputVariables[outputVariableIterator], extensionLocalPath);
                outputVariableIterator += 1;
            }
        }
        
        tl.debug('Set output Variable LocalPathsForInstalledExtensions to value: ' + extensionLocalPaths.slice(0, -1));
        tl.setVariable("LocalPathsForInstalledExtensions", extensionLocalPaths.slice(0, -1));
        
        if(anyExtensionInstalled) {
            await this.restart();
        }
    }

    public async restart() {
        try {
            console.log(tl.loc('RestartingKuduService'));
            var process0 = await this._appServiceKuduService.getProcess(0);
            tl.debug(`Process 0 ID: ${process0.id}`);
            await this._appServiceKuduService.killProcess(0);
            await this._pollForNewProcess(0, process0.id);
            console.log(tl.loc('RestartedKuduService'));
        }
        catch(error) {
            throw Error(tl.loc('FailedToRestartKuduService', error.toString()));
        }
    }

    public async updateDeploymentStatus(taskResult: boolean, DeploymentID: string, customMessage: any) {
        try {
            var requestBody = this._getUpdateHistoryRequest(taskResult, DeploymentID, customMessage);
            return await this._appServiceKuduService.updateDeployment(requestBody);
        }
        catch(error) {
            tl.warning(error);
        }
    }

    private async _pollForNewProcess(processID: number, id: number) {
        var retryCount = 6;
        while(true) {
            try {
                var process = await this._appServiceKuduService.getProcess(processID);
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

            tl.debug(`sleep for 5 seconds`)
            await webClient.sleepFor(5);
        }
    }

    private _getExtensionLocalPath(extensionInfo: JSON): string {
        var extensionId: string = extensionInfo['id'].replace(pythonExtensionPrefix, "");
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
}