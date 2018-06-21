import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as path from 'path';
import * as models from './models';
import * as inputParser from './inputparser';
import * as utils from './helpers';
import * as outStream from './outputstream';
import * as ci from './cieventlogger';
import * as testselectorinvoker from './testselectorinvoker';
import { AreaCodes, ResultMessages } from './constants';
import { ToolRunner } from 'vsts-task-lib/toolrunner';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as process from 'process';
import { InputDataContract } from './inputdatacontract';

const runSettingsExt = '.runsettings';
const testSettingsExt = '.testsettings';
const sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);

let inputDataContract: InputDataContract = undefined;
let testAssemblyFiles = undefined;

export function runNonDistributedTest(idc: InputDataContract) {
    try {

        console.log(tl.loc('runTestsLocally', 'vstest.console.exe'));
        console.log('========================================================');

        inputDataContract = idc;

        testAssemblyFiles = getTestAssemblies();
        if (!testAssemblyFiles || testAssemblyFiles.length === 0) {
            console.log('##vso[task.logissue type=warning;code=002004;]');
            tl.warning(tl.loc('NoMatchingTestAssemblies', sourceFilter));
            return;
        }

        const disableTIA = tl.getVariable('DisableTestImpactAnalysis');
        if (disableTIA !== undefined && disableTIA.toLowerCase() === 'true') {
            tl.debug('Disabling tia.');
            inputDataContract.ExecutionSettings.TiaSettings.Enabled = false;
        }

        startDtaExecutionHost().then((code: number) => {
            if (code !== 0) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailed'));
                return;
            }
        });

    } catch (err) {
        tl.error(err);
        tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailedReturnCode'));
    }
}

async function startDtaExecutionHost() {
    let dtaExecutionHostTool = tl.tool(path.join(inputDataContract.VsTestConsolePath, 'vstest.console.exe'));

    inputDataContract.TestSelectionSettings.TestSourcesFile = createTestSourcesFile();
    tl.cd(inputDataContract.TfsSpecificSettings.WorkFolder);
    let envVars: { [key: string]: string; } = process.env;
    dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));

    // Invoke DtaExecutionHost with the input json file
    const inputFilePath = utils.Helper.GenerateTempFile('input_' + uuid.v1() + '.json');
    utils.Helper.removeEmptyNodes(inputDataContract);

    try {
        fs.writeFileSync(inputFilePath, JSON.stringify(inputDataContract));
    } catch (e) {
        tl.setResult(tl.TaskResult.Failed, `Failed to write to the input json file ${inputFilePath} with error ${e}`);
    }

    if (utils.Helper.isDebugEnabled()) {
        utils.Helper.uploadFile(inputFilePath);
    }

    dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);

    utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);

    // hydra: See which of these are required in C# layer. Do we want this for telemetry??
    // utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentVersion', tl.getVariable('AGENT.VERSION'));

    if (inputDataContract.UsingXCopyTestPlatformPackage) {
        envVars = utils.Helper.setProfilerVariables(envVars);
    }

    const execOptions: tr.IExecOptions = <any>{
        env: envVars,
        failOnStdErr: false,
        // In effect this will not be called as failOnStdErr is false
        // Keeping this code in case we want to change failOnStdErr
        errStream: new outStream.StringErrorWritable({ decodeStrings: false })
    };

    // The error codes return below are not the same as tl.TaskResult which follows a different convention.
    // Here we are returning the code as returned to us by vstest.console in case of complete run
    // In case of a failure 1 indicates error to our calling function
    try {
        return await dtaExecutionHostTool.exec(execOptions);
    } catch (err) {
        tl.warning(tl.loc('VstestFailed'));
        tl.error(err);
        return 1;
    }
}

function getTestAssemblies(): string[] {
    tl.debug('Searching for test assemblies in: ' + inputDataContract.TestSelectionSettings.SearchFolder);
    return tl.findMatch(inputDataContract.TestSelectionSettings.SearchFolder, sourceFilter);
}

function createTestSourcesFile(): string {
    try {
        const sourceFilter = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
        console.log(tl.loc('UserProvidedSourceFilter', sourceFilter.toString()));

        const sources = tl.findMatch(inputDataContract.TestSelectionSettings.SearchFolder, sourceFilter);
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