import * as fs from 'fs';
import * as path from 'path';
import * as ps from 'child_process';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as models from './models';
import * as constants from './constants';
import * as inputdatacontract from './inputdatacontract';
import * as settingsHelper from './settingshelper';
import * as utils from './helpers';
import * as ta from './testagent';
import * as versionFinder from './versionfinder';
import * as os from 'os';
import * as ci from './cieventlogger';
import { TestSelectorInvoker } from './testselectorinvoker';
import { writeFileSync } from 'fs';
import { TaskResult } from 'vso-node-api/interfaces/TaskAgentInterfaces';
const uuid = require('uuid');

const testSelector = new TestSelectorInvoker();

export class DistributedTest {
    constructor(inputDataContract: inputdatacontract.InputDataContract) {
        this.dtaPid = -1;
        this.inputDataContract = inputDataContract;
    }

    public runDistributedTest() {
        this.publishCodeChangesIfRequired();
        this.invokeDtaExecutionHost();
    }

    private publishCodeChangesIfRequired(): void {
        if (this.inputDataContract.ExecutionSettings
            && this.inputDataContract.ExecutionSettings.TiaSettings
            && this.inputDataContract.ExecutionSettings.TiaSettings.Enabled) {

            // hydra: fix this
            const code = testSelector.publishCodeChangesInDistributedMode(this.inputDataContract);
            //todo: enable custom engine

            if (code !== 0) {
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
            }
        }
    }

    private async invokeDtaExecutionHost() {
        try {
            const exitCode = await this.startDtaExecutionHost();
            tl.debug('DtaExecutionHost finished');

            if (exitCode !== 0) {
                tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
                tl.setResult(tl.TaskResult.Failed, 'Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
            } else {
                tl.debug('Modules/DTAExecutionHost.exe exited');
                tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded');
            }
        } catch (error) {
            ci.publishEvent({ environmenturi: this.inputDataContract.RunIdentifier, error: error });
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, error);
        }
    }

    private async startDtaExecutionHost(): Promise<number> {

        // let envVars: { [key: string]: string; } = <{ [key: string]: string; }>{};
        let envVars: { [key: string]: string; } = process.env; // This is a temporary solution where we are passing parent process env vars, we should get away from this

        // Overriding temp with agent temp
        utils.Helper.addToProcessEnvVars(envVars, 'temp', utils.Helper.GetTempFolder());

        this.inputDataContract.TestSelectionSettings.TestSourcesFile = this.createTestSourcesFile();

        // Temporary solution till this logic can move to the test platform itself
        if (this.inputDataContract.UsingXCopyTestPlatformPackage) {
            envVars = this.setProfilerVariables(envVars);
        }

        // Pass the acess token as an environment variable for security purposes
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', this.inputDataContract.AccessToken);
        this.inputDataContract.AccessToken = null;

        // Invoke DtaExecutionHost with the input json file
        const inputFilePath = utils.Helper.GenerateTempFile('input_' + uuid.v1() + '.json');
        DistributedTest.removeEmptyNodes(this.inputDataContract);

        try {
            writeFileSync(inputFilePath, JSON.stringify(this.inputDataContract));
        } catch (e) {
            tl.setResult(tl.TaskResult.Failed, `Failed to write to the input json file ${inputFilePath} with error ${e}`);
        }

        if (utils.Helper.isDebugEnabled()) {
            utils.Helper.uploadFile(inputFilePath);
        }

        const dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
        dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);
        const code = await dtaExecutionHostTool.exec(<tr.IExecOptions>{ env: envVars });

        //hydra: add consolidated ci for inputs in C# layer for now
        const consolidatedCiData = {
            agentFailure: false
        };

        if (code !== 0) {
            consolidatedCiData.agentFailure = true;
        } else {
            tl.debug('Modules/DTAExecutionHost.exe exited');
        }
        ci.publishEvent(consolidatedCiData);
        return code;
    }

    // Utility function used to remove empty or spurious nodes from the input json file
    public static removeEmptyNodes(obj: any) {
        if (obj === null || obj === undefined ) {
            return;
        }
        if (typeof obj !== 'object' && typeof obj !== undefined) {
            return;
        }
        const keys = Object.keys(obj);
        for (var index in Object.keys(obj)) {
            if (obj[keys[index]] && obj[keys[index]] != {}) {
                DistributedTest.removeEmptyNodes(obj[keys[index]]);
            }
            if (obj[keys[index]] == undefined || obj[keys[index]] == null || (typeof obj[keys[index]] == "object" && Object.keys(obj[keys[index]]).length == 0)) {
                tl.debug(`Removing node ${keys[index]} as its value is ${obj[keys[index]]}.`);
                delete obj[keys[index]];
            }
        }
    }

    private createTestSourcesFile(): string {
        try {
            let sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);

            if (this.inputDataContract.TestSelectionSettings.TestSelectionType.toLowerCase() !== 'testassemblies') {
                sourceFilter = ['**\\*', '!**\\obj\\*'];
            }

            const sources = tl.findMatch(this.inputDataContract.TestSelectionSettings.SearchFolder, sourceFilter);
            tl.debug('tl match count :' + sources.length);
            const filesMatching = [];
            sources.forEach(function (match: string) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });

            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                throw new Error(tl.loc('noTestSourcesFound', sourceFilter.toString()));
            }

            const tempFile = utils.Helper.GenerateTempFile('testSources_' + uuid.v1() + '.src');
            fs.writeFileSync(tempFile, filesMatching.join(os.EOL));
            tl.debug('Test Sources file :' + tempFile);
            return tempFile;
        } catch (error) {
            throw new Error(tl.loc('testSourcesFilteringFailed', error));
        }
    }

    private setProfilerVariables(envVars: { [key: string]: string; }) : { [key: string]: string; } {
        const vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);

        // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (amd64)
        let amd64ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\amd64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
        if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {

            envVars['COR_PROFILER_PATH_64'] = amd64ProfilerProxy[0];
        } else {
            // Look in x64 also for Microsoft.IntelliTrace.ProfilerProxy.dll (x64)
            amd64ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\x64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
            if (amd64ProfilerProxy && amd64ProfilerProxy.length !== 0) {

                envVars['COR_PROFILER_PATH_64'] = amd64ProfilerProxy[0];
            } else {
                utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1043, false);
                tl.warning(tl.loc('testImpactAndCCWontWork'));
            }

            utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1042, false);
            tl.warning(tl.loc('testImpactAndCCWontWork'));
        }

        // get path to Microsoft.IntelliTrace.ProfilerProxy.dll (x86)
        const x86ProfilerProxy = tl.findMatch(vsTestPackageLocation, '**\\x86\\Microsoft.IntelliTrace.ProfilerProxy.dll');
        if (x86ProfilerProxy && x86ProfilerProxy.length !== 0) {
                envVars['COR_PROFILER_PATH_32'] = x86ProfilerProxy[0];
        } else {
            utils.Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1044, false);
            tl.warning(tl.loc('testImpactAndCCWontWork'));
        }

        return envVars;
    }

    private inputDataContract: inputdatacontract.InputDataContract;
    private dtaPid: number;
}