import tl = require('vsts-task-lib/task');
import Q = require('q');
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import webClient = require('azure-arm-rest/webClient');
import { TaskParameters } from './TaskParameters';
var deployUtility = require('webdeployment-common/utility.js');
var zipUtility = require('webdeployment-common/ziputility.js');

export class KuduServiceUtils {
    private _appServiceKuduService: Kudu;

    constructor(kuduService: Kudu) {
        this._appServiceKuduService = kuduService;
    }

    public async createPathIfRequired(phsyicalPath: string): Promise<void> {
        var listDir = await this._appServiceKuduService.listDir(phsyicalPath);
        if(listDir == null) {
            await this._appServiceKuduService.createPath(phsyicalPath);
        }
    }

    public async runPostDeploymentScript(taskParams: TaskParameters) {

    }

    public async deployWebPackage(packagePath: string, physicalPath: string, virtualPath: string, appOffline: boolean): Promise<void> {
        try {
            if(appOffline) {
                await this._appOfflineKuduService(physicalPath, true);
            }

            if(tl.stats(packagePath).isDirectory()) {
                let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                packagePath = await zipUtility.archiveFolder(packagePath, "", tempPackagePath);
                tl.debug("Compressed folder " + packagePath + " into zip : " +  packagePath);
            }
            else if(packagePath.toLowerCase().endsWith('.war')) {
                physicalPath = await this._warFileDeployment(packagePath, physicalPath, virtualPath);
            }

            await this._appServiceKuduService.extractZIP(packagePath, physicalPath);
            if(appOffline) {
                await this._appOfflineKuduService(physicalPath, false);
            }

            console.log(tl.loc('PackageDeploymentSuccess'));
        }
        catch(error) {
            tl.error(tl.loc('PackageDeploymentFailed'));
            throw Error(error);
        }
    }

    private _getPostDeploymentScript(scriptType, inlineScript, scriptPath, isLinux) {
        if(scriptType === 'Inline Script') {
            tl.debug('creating kuduPostDeploymentScript_local file');
            var scriptFilePath = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), isLinux ? 'kuduPostDeploymentScript_local.sh' : 'kuduPostDeploymentScript_local.cmd');
            tl.writeFile(scriptFilePath, inlineScript);
            tl.debug('Created temporary script file : ' + scriptFilePath);
            return {
                filePath: scriptFilePath,
                isCreated: true
            };
        }
        if(!tl.exist(scriptPath)) {
            throw Error(tl.loc('ScriptFileNotFound', scriptPath));
        }
        var scriptExtension = path.extname(scriptPath);
        if(isLinux){
            if(scriptExtension != '.sh'){
                throw Error(tl.loc('InvalidScriptFile', scriptPath));
            }
        } else {
            if(scriptExtension != '.bat' && scriptExtension != '.cmd') {
                throw Error(tl.loc('InvalidScriptFile', scriptPath));
            }
        }
        tl.debug('postDeployment script path to execute : ' + scriptPath);
        return {
            filePath: scriptPath,
            isCreated: false
        }
    }

    private async _warFileDeployment(packagePath: string, physicalPath: string, virtualPath?: string): Promise<string> {
        tl.debug('WAR: webAppPackage = ' + packagePath);
        let warFile = path.basename(packagePath.slice(0, packagePath.length - '.war'.length));
        let warExt = packagePath.slice(packagePath.length - '.war'.length)
        tl.debug('WAR: warFile = ' + warFile);
        warFile = warFile + ((virtualPath) ? "/" + virtualPath : "");
        tl.debug('WAR: warFile = ' + warFile);
        physicalPath = physicalPath + "/webapps/" + warFile;
        await this.createPathIfRequired(physicalPath);
        return physicalPath;

    }

    private async _appOfflineKuduService(physicalPath: string, enableFeature: boolean) {
        if(enableFeature) {
            tl.debug('Trying to enable app offline mode.');
            var appOfflineFilePath = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), 'app_offline_temp.htm');
            tl.writeFile(appOfflineFilePath, '<h1>App Service is offline.</h1>');
            await this._appServiceKuduService.uploadFile(physicalPath, 'app_offline.htm', appOfflineFilePath);
            tl.debug('App Offline mode enabled.');
        }
        else {
            tl.debug('Trying to disable app offline mode.');
            await this._appServiceKuduService.deleteFile(physicalPath, 'app_offline.htm');
            tl.debug('App Offline mode disabled.');
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