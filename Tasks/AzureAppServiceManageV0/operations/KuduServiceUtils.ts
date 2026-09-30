import tl = require('azure-pipelines-task-lib/task');
import os = require('os');

import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

const pythonExtensionPrefix = "azureappservice-";

interface ExtensionInfo {
    id: string;
    title: string;
    localPath: string;
    local_path: string;
}

interface Message extends Record<string, any> {
    type: string;
    commitId: string | undefined;
    buildId: string | undefined;
    releaseId: string | undefined;
    buildNumber: string | undefined;
    releaseName: string | undefined;
    repoProvider: string | undefined;
    repoName: string | undefined;
    collectionUrl: string | undefined;
    teamProject: string | undefined;
}

export class KuduServiceUtils {
    private _appServiceKuduService: Kudu;

    constructor(kuduService: Kudu) {
        this._appServiceKuduService = kuduService;
    }

    public async startContinuousWebJobs(): Promise<void> {
        console.log(tl.loc('StartingContinousWebJobs'));
        var webJobs = await this._appServiceKuduService.getContinuousJobs();
        for (var webJob of webJobs) {
            if (webJob.status.toLowerCase() == "running") {
                tl.writeExternalOutput(tl.loc('WebJobAlreadyInRunningState', webJob.name) + os.EOL, { source: 'remote' });
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
        for (var webJob of webJobs) {
            if (webJob.status.toLowerCase() == "stopped") {
                tl.writeExternalOutput(tl.loc('WebJobAlreadyInStoppedState', webJob.name) + os.EOL, { source: 'remote' });
            }
            else {
                await this._appServiceKuduService.stopContinuousWebJob(webJob.name);
            }
        }

        console.log(tl.loc('StoppedContinousWebJobs'));
    }

    public async installSiteExtensions(extensionList: Array<string>, outputVariables?: Array<string>): Promise<void> {
        outputVariables = outputVariables ? outputVariables : [];
        var outputVariableIterator: number = 0;
        var siteExtensions = await this._appServiceKuduService.getSiteExtensions();
        var allSiteExtensions = await this._appServiceKuduService.getAllSiteExtensions();
        var anyExtensionInstalled: boolean = false;
        var siteExtensionMap: Record<string, any> = {};
        var allSiteExtensionMap: Record<string, any> = {};
        var extensionLocalPaths: string = "";
        for (var siteExtension of siteExtensions) {
            siteExtensionMap[siteExtension.id] = siteExtension;
        }
        for (var siteExtension of allSiteExtensions) {
            allSiteExtensionMap[siteExtension.id] = siteExtension;
            allSiteExtensionMap[siteExtension.title] = siteExtension;
        }

        for (var extensionID of extensionList) {
            var siteExtensionDetails = null;
            if (allSiteExtensionMap[extensionID] && allSiteExtensionMap[extensionID].title == extensionID) {
                extensionID = allSiteExtensionMap[extensionID].id;
            }
            const alreadyInstalled = this._getInstalledSiteExtension(extensionID, siteExtensionMap);
            if (alreadyInstalled) {
                siteExtensionDetails = alreadyInstalled;
                tl.writeExternalOutput(tl.loc('ExtensionAlreadyInstalled', extensionID) + os.EOL, { source: 'remote' });
            }
            else {
                siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                anyExtensionInstalled = true;
            }

            var extensionLocalPath: string = this._getExtensionLocalPath(siteExtensionDetails);
            extensionLocalPaths += extensionLocalPath + ",";
            if (outputVariableIterator < outputVariables.length) {
                tl.debugExternalOutput('Set output Variable ' + outputVariables[outputVariableIterator] + ' to value: ' + extensionLocalPath, { source: 'remote' });
                tl.setVariable(outputVariables[outputVariableIterator], extensionLocalPath);
                outputVariableIterator += 1;
            }
        }

        tl.debugExternalOutput('Set output Variable LocalPathsForInstalledExtensions to value: ' + extensionLocalPaths.slice(0, -1), { source: 'remote' });
        tl.setVariable("LocalPathsForInstalledExtensions", extensionLocalPaths.slice(0, -1));

        if (anyExtensionInstalled) {
            await this.restart();
        }
    }

    /**
     * Installs site extensions with version support if specified (name@version).
     * Emits telemetry for attempts, successes, and failures.
     * Falls back to legacy behavior for non-versioned extensions.
     */
    public async installSiteExtensionsWithVersion(extensionList: Array<string>, outputVariables?: Array<string>): Promise<void> {
        outputVariables = outputVariables ? outputVariables : [];
        var outputVariableIterator: number = 0;
        var siteExtensions = await this._appServiceKuduService.getSiteExtensions();
        var allSiteExtensions = await this._appServiceKuduService.getAllSiteExtensions();
        var anyExtensionInstalled: boolean = false;
        var siteExtensionMap: Record<string, any> = {};
        var allSiteExtensionMap: Record<string, any> = {};
        var extensionLocalPaths: string = "";
        for (var siteExtension of siteExtensions) {
            siteExtensionMap[siteExtension.id] = siteExtension;
        }
        for (var siteExtension of allSiteExtensions) {
            allSiteExtensionMap[siteExtension.id] = siteExtension;
            allSiteExtensionMap[siteExtension.title] = siteExtension;
        }
        for (const ext of extensionList) {
            const { name, version } = this._parseExtensionNameAndVersion(ext);
            if (!name) {
                tl.warning(`Malformed extension input: '${ext}'`);
                continue;
            }
            let extensionID = name;
            if (allSiteExtensionMap[extensionID] && allSiteExtensionMap[extensionID].title == extensionID) {
                extensionID = allSiteExtensionMap[extensionID].id;
            }
            try {
                let siteExtensionDetails = null;
                const alreadyInstalled = this._getInstalledSiteExtension(extensionID, siteExtensionMap);
                if (version) {
                    if (version.toLowerCase() === 'latest') {
                        if (alreadyInstalled && alreadyInstalled.local_is_latest_version !== false) {
                            tl.debugExternalOutput(`Extension '${extensionID}' is already at latest version (local_is_latest_version: true), skipping install.`, { source: 'remote' });
                            siteExtensionDetails = alreadyInstalled;
                        } else {
                            siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                            anyExtensionInstalled = true;
                        }
                    } else {
                        if (alreadyInstalled && alreadyInstalled.version === version) {
                            tl.debugExternalOutput(`Extension '${extensionID}' is already at specified version '${version}', skipping install.`, { source: 'remote' });
                            siteExtensionDetails = alreadyInstalled;
                        } else {
                            siteExtensionDetails = await this._appServiceKuduService.installSiteExtensionWithVersion(extensionID, version);
                            anyExtensionInstalled = true;
                        }
                    }
                } else {
                    if (alreadyInstalled) {
                        siteExtensionDetails = alreadyInstalled;
                        tl.debugExternalOutput('ExtensionAlreadyInstalled: ' + extensionID, { source: 'remote' });
                    } else {
                        siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                        anyExtensionInstalled = true;
                    }
                }
                var extensionLocalPath: string = this._getExtensionLocalPath(siteExtensionDetails as any);
                extensionLocalPaths += extensionLocalPath + ",";
                if (outputVariableIterator < outputVariables.length) {
                    tl.debugExternalOutput('Set output Variable ' + outputVariables[outputVariableIterator] + ' to value: ' + extensionLocalPath, { source: 'remote' });
                    tl.setVariable(outputVariables[outputVariableIterator], extensionLocalPath);
                    outputVariableIterator += 1;
                }
            } catch (err) {
                tl.warningExternalOutput(`Failed to install extension ${name}${version ? '@' + version : ''}: ${err}`, { source: 'remote' });
            }
        }
        tl.debugExternalOutput('Set output Variable LocalPathsForInstalledExtensions to value: ' + extensionLocalPaths.slice(0, -1), { source: 'remote' });
        tl.setVariable("LocalPathsForInstalledExtensions", extensionLocalPaths.slice(0, -1));
        if (anyExtensionInstalled) {
            await this.restart();
        }
    }

    public async restart() {
        try {
            console.log(tl.loc('RestartingKuduService'));
            var process0 = await this._appServiceKuduService.getProcess(0);
            tl.debugExternalOutput(`Process 0 ID: ${process0.id}`, { source: 'remote' });
            await this._appServiceKuduService.killProcess(0);
            await this._pollForNewProcess(0, process0.id);
            console.log(tl.loc('RestartedKuduService'));
        }
        catch (error) {
            throw Error(tl.loc('FailedToRestartKuduService', (error instanceof Error) ? error.toString() : String(error)));
        }
    }

    public async updateDeploymentStatus(taskResult: boolean, DeploymentID: string, customMessage: any) {
        try {
            var requestBody = this._getUpdateHistoryRequest(taskResult, DeploymentID, customMessage);
            return await this._appServiceKuduService.updateDeployment(requestBody);
        }
        catch (error) {
            tl.warningExternalOutput(String(error), { source: 'remote' });
        }
    }

    private async _pollForNewProcess(processID: number, id: number) {
        var retryCount = 6;
        while (true) {
            try {
                var process = await this._appServiceKuduService.getProcess(processID);
                tl.debugExternalOutput(`process ${processID} ID: ${process.id}`, { source: 'remote' });
                if (process.id != id) {
                    tl.debug(`New Process created`);
                    return process;
                }
            }
            catch (error) {
                tl.debugExternalOutput(`error while polling for process ${processID}: ` + ((error instanceof Error) ? error.toString() : String(error)), { source: 'remote' });
            }
            retryCount -= 1;
            if (retryCount == 0) {
                throw new Error(tl.loc('TimeoutWhileWaiting'));
            }

            tl.debug(`sleep for 5 seconds`)
            await webClient.sleepFor(5);
        }
    }

    private _getExtensionLocalPath(extensionInfo: ExtensionInfo): string {
        var extensionId: string = extensionInfo['id'].replace(pythonExtensionPrefix, "");
        var homeDir = "D:\\home\\";

        if (extensionId.startsWith('python2')) {
            return homeDir + "Python27";
        }
        else if (extensionId.startsWith('python351') || extensionId.startsWith('python352')) {
            return homeDir + "Python35";
        }
        else if (extensionId.startsWith('python3')) {
            return homeDir + extensionId;
        }
        else {
            return extensionInfo['local_path'];
        }
    }

    private _getUpdateHistoryRequest(isDeploymentSuccess: boolean, deploymentID?: string, customMessage?: Message): any {
        const status = isDeploymentSuccess ? 4 : 3;
        const author = tl.getVariable('build.sourceVersionAuthor') || tl.getVariable('build.requestedfor') ||
            tl.getVariable('release.requestedfor') || tl.getVariable('agent.name')

        const buildUrl = tl.getVariable('build.buildUri');
        const releaseUrl = tl.getVariable('release.releaseUri');

        const buildId = tl.getVariable('build.buildId');
        const releaseId = tl.getVariable('release.releaseId');

        const buildNumber = tl.getVariable('build.buildNumber');
        const releaseName = tl.getVariable('release.releaseName');

        const collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri')!;
        const teamProject = tl.getVariable('system.teamProjectId');

        const commitId = tl.getVariable('build.sourceVersion');
        const repoName = tl.getVariable('build.repository.name');
        const repoProvider = tl.getVariable('build.repository.provider');

        let buildOrReleaseUrl = "";
        deploymentID = !!deploymentID ? deploymentID : (releaseId ? releaseId : buildId) + Date.now().toString();

        if (releaseUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
        }
        else if (buildUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
        }

        const message: Message = {
            type: customMessage ? customMessage.type : "",
            commitId: commitId,
            buildId: buildId,
            releaseId: releaseId,
            buildNumber: buildNumber,
            releaseName: releaseName,
            repoProvider: repoProvider,
            repoName: repoName,
            collectionUrl: collectionUrl,
            teamProject: teamProject
        };
        // Append Custom Messages to original message
        for (const attribute in customMessage) {
            message[attribute] = customMessage[attribute];
        }

        const deploymentLogType: string = message['type'];
        let active: boolean = false;
        if (deploymentLogType.toLowerCase() === "deployment" && isDeploymentSuccess) {
            active = true;
        }

        return {
            id: deploymentID,
            active: active,
            status: status,
            message: JSON.stringify(message),
            author: author,
            deployer: 'VSTS',
            details: buildOrReleaseUrl
        };
    }

    /**
     * Helper to parse extension name and version from a string like 'name@version'.
     * Returns { name: string, version: string|null }.
     * Handles edge cases: missing name, empty version, malformed input.
     */
    private _parseExtensionNameAndVersion(extension: string): { name: string, version: string | null } {
        if (!extension || typeof extension !== 'string') {
            return { name: '', version: null };
        }
        const atIdx = extension.indexOf('@');
        if (atIdx === -1) {
            return { name: extension, version: null };
        }
        const name = extension.substring(0, atIdx).trim();
        const version = extension.substring(atIdx + 1).trim();
        if (!name) {
            return { name: '', version: null };
        }
        if (!version) {
            return { name, version: null };
        }
        return { name, version };
    }

    /**
     * Checks if the versioned extension install feature flag is enabled.
     * Uses pipeline variable injection. Name: EnableExtensionVersionSupport
     */
    public static isExtensionVersionSupportEnabled(): boolean {
        return tl.getPipelineFeature('EnableExtensionVersionSupport');
    }

    /**
     * Returns the installed site extension details if present, including python-prefixed extensions.
     * Python extensions are moved to Nuget and the extensions IDs are changed. The below check ensures that old extensions are mapped to new extension ID.
     */
    private _getInstalledSiteExtension(extensionID: string, siteExtensionMap: any): any {
        if (siteExtensionMap[extensionID]) {
            return siteExtensionMap[extensionID];
        }
        if (extensionID.startsWith('python') && siteExtensionMap[pythonExtensionPrefix + extensionID]) {
            return siteExtensionMap[pythonExtensionPrefix + extensionID];
        }
        return null;
    }
}