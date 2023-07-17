import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility');
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { AzureDeployPackageArtifactAlias, KUDU_DEPLOYMENT_CONSTANTS } from 'azure-pipelines-tasks-azure-arm-rest/constants';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

const physicalRootPath: string = '/site/wwwroot';
const deploymentFolder: string = 'site/deployments';
const manifestFileName: string = 'manifest';
const VSTS_ZIP_DEPLOY: string = 'VSTS_ZIP_DEPLOY_FUNCTIONS_V2';
const VSTS_DEPLOY: string = 'VSTS_FUNCTIONS_V2';

export class KuduServiceUtility {
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
        var buildId = tl.getVariable('build.buildId');
        var releaseId = tl.getVariable('release.releaseId');

        var deploymentID: string = (releaseId ? releaseId : buildId) + Date.now().toString();
        return deploymentID;
    }

    public async deployWebPackage(packagePath: string, physicalPath: string, virtualPath: string, appOffline?: boolean): Promise<void> {
        physicalPath = physicalPath ? physicalPath : physicalRootPath;
        try {
            if(appOffline) {
                await this._appOfflineKuduService(physicalPath, true);
                tl.debug('Wait for 5 seconds for app_offline to take effect');
                await webClient.sleepFor(5);
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

            console.log(tl.loc("Successfullydeployedpackageusingkuduserviceat", packagePath, physicalPath));
        }
        catch(error) {
            tl.error(tl.loc('PackageDeploymentFailed'));
            throw Error(error);
        }
    }

    public async deployUsingZipDeploy(packagePath: string): Promise<string> {
        try {
            console.log(tl.loc('PackageDeploymentInitiated'));

            let queryParameters: Array<string> = [
                'isAsync=true',
                'deployer=' + VSTS_ZIP_DEPLOY
            ];
            let deploymentDetails = await this._appServiceKuduService.zipDeploy(packagePath, queryParameters);
            await this._processDeploymentResponse(deploymentDetails);

            console.log(tl.loc('PackageDeploymentSuccess'));
            return deploymentDetails.id;
        }
        catch(error) {
            let stackTraceUrl:string = this._appServiceKuduService.getKuduStackTraceUrl();
            tl.error(tl.loc('PackageDeploymentFailed'));
            tl.error(tl.loc('KuduStackTraceURL', stackTraceUrl));
            throw Error(error);
        }
    }

    public async deployUsingRunFromZip(packagePath: string, customMessage?: any) : Promise<void> {
        try {
            console.log(tl.loc('PackageDeploymentInitiated'));
            //zipdeploy async api ref: https://github.com/projectkudu/kudu/wiki/Deploying-from-a-zip-file-or-url#asynchronous-zip-deployment
            let queryParameters: Array<string> = [
                'isAsync=true',
                'deployer=' +   VSTS_DEPLOY
            ];
            var deploymentMessage = this._getUpdateHistoryRequest(null, null, customMessage).message;
            queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
            let deploymentDetails = await this._appServiceKuduService.zipDeploy(packagePath, queryParameters);
            await this._processDeploymentResponse(deploymentDetails);
            console.log(tl.loc('PackageDeploymentSuccess'));
            console.log("NOTE: Run From Package makes wwwroot read-only, so you will receive an error when writing files to this directory.");
        }
        catch(error) {
            let stackTraceUrl:string = this._appServiceKuduService.getKuduStackTraceUrl();
            tl.error(tl.loc('PackageDeploymentFailed'));
            tl.error(tl.loc('KuduStackTraceURL', stackTraceUrl));
            throw Error(error);
        }
    }

    public async deployUsingWarDeploy(packagePath: string, customMessage?: any, targetFolderName?: any): Promise<string> {
        try {
            console.log(tl.loc('WarPackageDeploymentInitiated'));

            let queryParameters: Array<string> = [
                'isAsync=true'
            ];

            if(targetFolderName) {
                queryParameters.push('name=' + encodeURIComponent(targetFolderName));
            }

            var deploymentMessage = this._getUpdateHistoryRequest(null, null, customMessage).message;
            queryParameters.push('message=' + encodeURIComponent(deploymentMessage));
            let deploymentDetails = await this._appServiceKuduService.warDeploy(packagePath, queryParameters);
            await this._processDeploymentResponse(deploymentDetails);
            console.log(tl.loc('PackageDeploymentSuccess'));

            return deploymentDetails.id;
        }
        catch(error) {
            tl.error(tl.loc('PackageDeploymentFailed'));
            throw Error(error);
        }
    }

    public async postZipDeployOperation(oldDeploymentID: string, activeDeploymentID: string): Promise<void> {
        try {
            tl.debug(`ZIP DEPLOY - Performing post zip-deploy operation: ${oldDeploymentID} => ${activeDeploymentID}`);
            let manifestFileContent = await this._appServiceKuduService.getFileContent(`${deploymentFolder}/${oldDeploymentID}`, manifestFileName);
            if(!!manifestFileContent) {
                let tempManifestFile: string = path.join(tl.getVariable('AGENT.TEMPDIRECTORY'), manifestFileName);
                tl.writeFile(tempManifestFile, manifestFileContent);
                await this._appServiceKuduService.uploadFile(`${deploymentFolder}/${activeDeploymentID}`, manifestFileName, tempManifestFile);
            }
            tl.debug('ZIP DEPLOY - Performed post-zipdeploy operation.');
        }
        catch(error) {
            tl.debug(`Failed to execute post zip-deploy operation: ${JSON.stringify(error)}.`);
        }
    }

    public async warmpUp(): Promise<void> {
        try {
            tl.debug('warming up Kudu Service');
            await this._appServiceKuduService.getAppSettings();
            tl.debug('warmed up Kudu Service');
        }
        catch(error) {
            tl.debug('Failed to warm-up Kudu: ' + error.toString());
        }
    }

    private async _processDeploymentResponse(deploymentDetails: any): Promise<void> {
        try {
            var kuduDeploymentDetails = await this._appServiceKuduService.getDeploymentDetails(deploymentDetails.id);
            let sysDebug = tl.getVariable('system.debug');

            if(deploymentDetails.status == KUDU_DEPLOYMENT_CONSTANTS.FAILED || sysDebug && sysDebug.toLowerCase() == 'true') {
                tl.debug(`logs from kudu deploy: ${kuduDeploymentDetails.log_url}`);
                await this._printZipDeployLogs(kuduDeploymentDetails.log_url);
            }
            else {
                console.log(tl.loc('DeployLogsURL', kuduDeploymentDetails.log_url));
            }
        }
        catch(error) {
            tl.debug(`Unable to fetch logs for kudu Deploy: ${JSON.stringify(error)}`);
        }

        if(deploymentDetails.status == KUDU_DEPLOYMENT_CONSTANTS.FAILED) {
            throw tl.loc('PackageDeploymentUsingZipDeployFailed');
        }
    }

    private async _printZipDeployLogs(log_url: string): Promise<void> {
        if(!log_url) {
            return;
        }

        var deploymentLogs = await this._appServiceKuduService.getDeploymentLogs(log_url);
        for(var deploymentLog of deploymentLogs) {
            console.log(`${deploymentLog.message}`);
            if(deploymentLog.details_url) {
                await this._printZipDeployLogs(deploymentLog.details_url);
            }
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

    private async _appOfflineKuduService(physicalPath: string, enableFeature: boolean): Promise<void> {
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

        var artifactAlias = tl.getVariable(AzureDeployPackageArtifactAlias);
        var status = isDeploymentSuccess ? KUDU_DEPLOYMENT_CONSTANTS.SUCCESS : KUDU_DEPLOYMENT_CONSTANTS.FAILED;
        var releaseId = tl.getVariable('release.releaseId');
        var releaseName = tl.getVariable('release.releaseName');
        var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri');
        var teamProject = tl.getVariable('system.teamProjectId');
        let buildId = '', buildNumber = '', buildProject = '', commitId = '', repoProvider = '', repoName = '', branch = '', repositoryUrl = '', author = '';

        if (releaseId && artifactAlias) {
            // Task is running in release determine build information of selected artifact using artifactAlias
            author = tl.getVariable('release.requestedfor') || tl.getVariable('agent.name');
            tl.debug(`Artifact Source Alias is: ${artifactAlias}`);

            commitId = tl.getVariable(`release.artifacts.${artifactAlias}.sourceVersion`);
            repoProvider = tl.getVariable(`release.artifacts.${artifactAlias}.repository.provider`);
            repoName = tl.getVariable(`release.artifacts.${artifactAlias}.repository.name`);
            branch = tl.getVariable(`release.artifacts.${artifactAlias}.sourcebranchname`) || tl.getVariable(`release.artifacts.${artifactAlias}.sourcebranch`);

            let artifactType = tl.getVariable(`release.artifacts.${artifactAlias}.type`);
            if (artifactType && artifactType.toLowerCase() == "tfvc") {
                repositoryUrl = `${collectionUrl}${buildProject}/_versionControl`;
                repoProvider = "tfsversioncontrol";
            }
            else if(artifactType && artifactType.toLowerCase() == "build") {
                buildId = tl.getVariable(`release.artifacts.${artifactAlias}.buildId`);
                buildNumber = tl.getVariable(`release.artifacts.${artifactAlias}.buildNumber`);
                buildProject = tl.getVariable(`release.artifacts.${artifactAlias}.projectId`);
            }
            else {
                repositoryUrl = tl.getVariable(`release.artifacts.${artifactAlias}.repository.uri`);
            }
        }
        else {
            // Task is running in build OR artifact alias not found so use primary artifact variables
            author = tl.getVariable('build.requestedfor') || tl.getVariable('agent.name');

            buildId = tl.getVariable('build.buildId');
            buildNumber = tl.getVariable('build.buildNumber');
            buildProject = teamProject;

            commitId = tl.getVariable('build.sourceVersion');
            repoName = tl.getVariable('build.repository.name');
            repoProvider = tl.getVariable('build.repository.provider');
            repositoryUrl = tl.getVariable("build.repository.uri") || "";
            branch = tl.getVariable("build.sourcebranchname") || tl.getVariable("build.sourcebranch");
        }

        deploymentID = !!deploymentID ? deploymentID : this.getDeploymentID();

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
            teamProject : teamProject,
            buildProjectUrl: buildProject ? collectionUrl + buildProject : "",
            repositoryUrl: repositoryUrl,
            branch: branch,
            teamProjectName: tl.getVariable("system.teamproject")
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
            deployer : 'VSTS'
        };
    }

    public async getZipDeployValidation(packagePath: string, zipLanguage?: string, zipIs64Bit?: string): Promise<void> {
        try {
            console.log("Validating deployment package for functions app before Zip Deploy");
            let queryParameters: Array<string> = [
                'zipLanguage=' + !!zipLanguage ? zipLanguage : '',
                'zipIs64Bit=' + !!zipIs64Bit ? zipIs64Bit : ''
            ];
            await this.validateZipDeploy(packagePath, queryParameters);
        }
        catch(error) {
            throw Error(error);
        }
    }

    public async validateZipDeploy(webPackage: string, queryParameters?: Array<string>): Promise<any> {
        try {
            var stats = fs.statSync(webPackage);
            var fileSizeInBytes = stats.size;
            let httpRequest: webClient.WebRequest = {
                method: 'POST',
                uri: this._appServiceKuduService.client.getRequestUri(`/api/zipdeploy/validate`, queryParameters),
                body: fs.createReadStream(webPackage),
                headers: {
                    'Content-Length': fileSizeInBytes
                },
            };
            let requestOptions = new webClient.WebRequestOptions();
            requestOptions.retriableStatusCodes = [500, 502, 503, 504];
            requestOptions.retryIntervalInSeconds = 5;

            let response = await this._appServiceKuduService.client.beginRequest(httpRequest, requestOptions, 'application/octet-stream');
            if (response.statusCode == 200) {
                tl.debug(`Validation passed response: ${JSON.stringify(response)}`);
                if (response.body && response.body.result){
                    tl.warning(`${JSON.stringify(response.body.result)}`);
                }
                return null;
            }
            else if (response.statusCode == 400) {
                tl.debug(`Validation failed response: ${JSON.stringify(response)}`);
                throw response;
            }
            else {
                tl.debug(`Skipping validation with status: ${response.statusCode}`);
                return null;
            }
        }
        catch(error) {
            if (error && error.body && error.body.result && typeof error.body.result.valueOf() == 'string' && error.body.result.includes('ZipDeploy Validation ERROR')) {
                throw Error(JSON.stringify(error.body.result));
            }
            else {
                tl.debug(`Skipping validation with error: ${error}`);
                return null;
            }
        }
    }
}