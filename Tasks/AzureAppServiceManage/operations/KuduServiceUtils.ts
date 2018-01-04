import tl = require('vsts-task-lib/task');
import Q = require('q');
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import webClient = require('azure-arm-rest/webClient');

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

    public async installSiteExtensions(extensionList: Array<string>, outputVariables?: Array<string>): Promise<void> {
        outputVariables = outputVariables ? outputVariables : [];
        var outputVariableIterator: number = 0;
        var siteExtensions = await this._appServiceKuduService.getSiteExtensions();
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
                siteExtensionDetails = await this._appServiceKuduService.installSiteExtension(extensionID);
                anyExtensionInstalled = true;
            }

            if(outputVariableIterator < outputVariables.length) {
                var extensionLocalPath: string = this._getExtensionLocalPath(siteExtensionDetails);
                tl.debug('Set output Variable ' + outputVariables[outputVariableIterator] + ' to value: ' + extensionLocalPath);
                tl.setVariable(outputVariables[outputVariableIterator], extensionLocalPath);
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

            tl.debug(`sleep for 10 seconds`)
            await webClient.sleepFor(10);
        }
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