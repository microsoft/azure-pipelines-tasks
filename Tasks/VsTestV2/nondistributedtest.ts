import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as path from 'path';
import * as utils from './helpers';
import * as ci from './cieventlogger';
import * as outStream from './outputstream';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as process from 'process';
import { InputDataContract } from './inputdatacontract';

export class NonDistributedTest {
    constructor(inputDataContract: InputDataContract) {
        this.inputDataContract = inputDataContract;
    }

    public runNonDistributedTest() {
        this.invokeDtaExecutionHost();
    }

    private async invokeDtaExecutionHost() {
        try {
            console.log(tl.loc('runTestsLocally', 'vstest.console.exe'));
            console.log('========================================================');
            const exitCode = await this.startDtaExecutionHost();
            tl.debug('DtaExecutionHost finished');

            if (exitCode !== 0 && !this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures) {
                tl.debug('Modules/DTAExecutionHost.exe process exited with code ' + exitCode);
                tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailed'), true);
                return;
            } else {
                if (exitCode !== 0) {
                    console.log('Task marked as success because IgnoreTestFailures is enabled');
                }
                tl.debug(`Modules/DTAExecutionHost.exe exited with code ${exitCode}`);
                tl.setResult(tl.TaskResult.Succeeded, 'Task succeeded', true);
            }

        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailedReturnCode'), true);
        }
    }

    private async startDtaExecutionHost(): Promise<number> {
        let dtaExecutionHostTool = tl.tool(path.join(this.inputDataContract.VsTestConsolePath, 'vstest.console.exe'));

        this.inputDataContract.TestSelectionSettings.TestSourcesFile = this.createTestSourcesFile();
        tl.cd(this.inputDataContract.TfsSpecificSettings.WorkFolder);
        let envVars: { [key: string]: string; } = process.env;
        dtaExecutionHostTool = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));

        // Invoke DtaExecutionHost with the input json file
        const inputFilePath = utils.Helper.GenerateTempFile('input_' + uuid.v1() + '.json');
        utils.Helper.removeEmptyNodes(this.inputDataContract);

        try {
            fs.writeFileSync(inputFilePath, JSON.stringify(this.inputDataContract));
        } catch (e) {
            tl.setResult(tl.TaskResult.Failed, `Failed to write to the input json file ${inputFilePath} with error ${e}`);
        }

        dtaExecutionHostTool.arg(['--inputFile', inputFilePath]);

        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);

        if (this.inputDataContract.ExecutionSettings.DiagnosticsSettings.Enabled) {
            utils.Helper.addToProcessEnvVars(envVars, 'PROCDUMP_PATH', path.join(__dirname, 'ProcDump'));
        }

        // hydra: See which of these are required in C# layer. Do we want this for telemetry??
        // utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentVersion', tl.getVariable('AGENT.VERSION'));

        if (this.inputDataContract.UsingXCopyTestPlatformPackage) {
            envVars = utils.Helper.setProfilerVariables(envVars);
        }

        const execOptions: tr.IExecOptions = <any>{
            IgnoreTestFailures: this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.IgnoreTestFailures,
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
    private createTestSourcesFile(): string {
        try {
            console.log(tl.loc('UserProvidedSourceFilter', this.sourceFilter.toString()));
            const telemetryProps: { [key: string]: any; } = { MiniMatchLines: this.sourceFilter.length };
            telemetryProps.ExecutionFlow = 'NonDistributed';
            const start = new Date().getTime();
            const sources = tl.findMatch(this.inputDataContract.TestSelectionSettings.SearchFolder, this.sourceFilter);
            const timeTaken = new Date().getTime() - start;
            tl.debug(`Time taken for applying the minimatch pattern to filter out the sources ${timeTaken} ms`);
            telemetryProps.TimeToSearchDLLsInMilliSeconds = timeTaken;
            tl.debug(`${sources.length} files matched the given minimatch filter`);
            ci.publishTelemetry('TestExecution','MinimatchFilterPerformance', telemetryProps);
            const filesMatching = [];
            sources.forEach(function (match: string) {
                if (!fs.lstatSync(match).isDirectory()) {
                    filesMatching.push(match);
                }
            });

            tl.debug('Files matching count :' + filesMatching.length);
            if (filesMatching.length === 0) {
                tl.warning(tl.loc('noTestSourcesFound', this.sourceFilter.toString()));
                if (this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.ActionOnThresholdNotMet.toLowerCase() === 'fail') {
                    throw new Error(tl.loc('minTestsNotExecuted', this.inputDataContract.TestReportingSettings.ExecutionStatusSettings.MinimumExecutedTestsExpected));
                } else {
                    tl.setResult(tl.TaskResult.Succeeded, tl.loc('noTestSourcesFound', this.sourceFilter.toString()), true);
                    process.exit(0);
                }
            }

            const tempFile = utils.Helper.GenerateTempFile('testSources_' + uuid.v1() + '.src');
            fs.writeFileSync(tempFile, filesMatching.join(os.EOL));
            tl.debug('Test Sources file :' + tempFile);
            return tempFile;
        } catch (error) {
            throw new Error(tl.loc('testSourcesFilteringFailed', error));
        }
    }

    private inputDataContract: InputDataContract;
    private sourceFilter: string[] = tl.getDelimitedInput('testAssemblyVer2', '\n', true);
}