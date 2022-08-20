import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as  path from 'path';
import * as models from './models';
import * as taskInputParser from './taskinputparser';
import * as settingsHelper from './settingshelper';
import * as utils from './helpers';
import * as outStream from './outputstream';
import * as ci from './cieventlogger';
import * as testselectorinvoker from './testselectorinvoker';
import { AreaCodes, ResultMessages } from './constants';
import * as os from 'os';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as process from 'process';
import { isFeatureFlagEnabled } from './runvstest';

const runSettingsExt = '.runsettings';
const testSettingsExt = '.testsettings';

let vstestConfig: models.VsTestConfigurations = undefined;
let tiaConfig: models.TiaConfiguration = undefined;
const workingDirectory = utils.Constants.systemDefaultWorkingDirectory;
let testAssemblyFiles = undefined;
let resultsDirectory = null;

export function startTest() {
    try {
        console.log(tl.loc('runTestsLocally', 'vstest.console.exe'));
        console.log('========================================================');
        try {
            vstestConfig = taskInputParser.getvsTestConfigurations();
        } catch (error) {
            utils.Helper.publishEventToCi(AreaCodes.RUNTESTSLOCALLY, error.message, 1038, true);
            throw (error);
        }
        console.log('========================================================');

        tiaConfig = vstestConfig.tiaConfig;

        // Try to find the results directory for clean up.
        // This may change later if runsettings has results directory and location go runsettings file changes.
        resultsDirectory = getTestResultsDirectory(vstestConfig.settingsFile, path.join(workingDirectory, 'TestResults'));
        tl.debug('TestRunResults Directory : ' + resultsDirectory);

        // clean up old testResults
        tl.rmRF(resultsDirectory);
        tl.mkdirP(resultsDirectory);

        testAssemblyFiles = getTestAssemblies();

        if (!testAssemblyFiles || testAssemblyFiles.length === 0) {
            uploadVstestDiagFile();
            console.log('##vso[task.logissue type=warning;code=002004;]');
            tl.warning(tl.loc('NoMatchingTestAssemblies', vstestConfig.sourceFilter));
            return;
        }

        var consolidatedCiData = {
            agentPhaseSettings: tl.getVariable('System.ParallelExecutionType'),
            codeCoverageEnabled: vstestConfig.codeCoverageEnabled,
            overrideTestrunParameters: utils.Helper.isNullOrUndefined(vstestConfig.overrideTestrunParameters) ? 'false' : 'true',
            pipeline: tl.getVariable('release.releaseUri') != null ? 'release' : 'build',
            runTestsInIsolation: vstestConfig.runTestsInIsolation,
            task: 'VsTestConsoleFlow',
            runInParallel: vstestConfig.runInParallel,
            result: 'Failed',
            settingsType: !utils.Helper.isNullOrUndefined(vstestConfig.settingsFile) ? vstestConfig.settingsFile.endsWith('.runsettings') ? 'runsettings' : vstestConfig.settingsFile.endsWith('.testsettings') ? 'testsettings' : 'none' : 'none',
            testSelection: vstestConfig.testSelection,
            tiaEnabled: vstestConfig.tiaConfig.tiaEnabled,
            vsTestVersion: vstestConfig.vsTestVersionDetails.majorVersion + '.' + vstestConfig.vsTestVersionDetails.minorversion + '.' + vstestConfig.vsTestVersionDetails.patchNumber,
            consoleOptionsEnabled:
                !utils.Helper.isNullOrWhitespace(vstestConfig.otherConsoleOptions) ? vstestConfig.otherConsoleOptions : '',
            rerunEnabled: vstestConfig.rerunFailedTests,
            rerunType: utils.Helper.isNullEmptyOrUndefined(vstestConfig.rerunType) ? '' : vstestConfig.rerunType
        };

        invokeVSTest().then(function (taskResult) {
            uploadVstestDiagFile();
            if (vstestConfig.tiaConfig.tiaEnabled) {
                uploadFile(path.join(os.tmpdir(), 'TestImpactZip.zip'));
                uploadFile(path.join(os.tmpdir(), 'TestSelector.log'));
            }
            if (taskResult == tl.TaskResult.Failed) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailedReturnCode'), true);
            }
            else {
                consolidatedCiData.result = 'Succeeded';
                tl.setResult(tl.TaskResult.Succeeded, tl.loc('VstestPassedReturnCode'), true);
            }
            ci.publishEvent(consolidatedCiData);

        }).catch(function (err) {
            uploadVstestDiagFile();
            utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, err.message, 1002, false);
            console.log('##vso[task.logissue type=error;code=' + err + ';TaskName=VSTest]');
            tl.setResult(tl.TaskResult.Failed, err, true);
        });
    } catch (error) {
        uploadVstestDiagFile();
        utils.Helper.publishEventToCi(AreaCodes.RUNTESTSLOCALLY, error.message, 1003, false);
        tl.setResult(tl.TaskResult.Failed, error, true);
    }
}

function getTestAssemblies(): string[] {
    tl.debug('Searching for test assemblies in: ' + vstestConfig.testDropLocation);
    return tl.findMatch(vstestConfig.testDropLocation, vstestConfig.sourceFilter);
}

function getVstestArguments(settingsFile: string, addTestCaseFilter: boolean): string[] {
    const argsArray: string[] = [];
    testAssemblyFiles.forEach(function (testAssembly) {
        let testAssemblyPath = testAssembly;
        //To maintain parity with the behaviour when test assembly was filepath, try to expand it relative to build sources directory.
        if (utils.Constants.systemDefaultWorkingDirectory && !utils.Helper.pathExistsAsFile(testAssembly)) {
            const expandedPath = path.join(utils.Constants.systemDefaultWorkingDirectory, testAssembly);
            if (utils.Helper.pathExistsAsFile(expandedPath)) {
                testAssemblyPath = expandedPath;
            }
        }
        argsArray.push(testAssemblyPath);
    });
    if (vstestConfig.testcaseFilter && addTestCaseFilter) {
        argsArray.push('/TestCaseFilter:' + vstestConfig.testcaseFilter);
    }

    if (settingsFile) {
        if (utils.Helper.pathExistsAsFile(settingsFile)) {
            argsArray.push('/Settings:' + settingsFile);
            utils.Helper.readFileContents(settingsFile, 'utf-8').then(function (settings) {
                tl.debug('Running VsTest with settings : ');
                utils.Helper.printMultiLineLog(settings, (logLine) => { console.log('##vso[task.debug]' + logLine); });
            });
        } else {
            if (!tl.exist(settingsFile)) {
                // because this is filepath input build puts default path in the input. To avoid that we are checking this.
                utils.Helper.publishEventToCi(AreaCodes.INVALIDSETTINGSFILE, 'InvalidSettingsFile', 1004, true);
                tl.setResult(tl.TaskResult.Failed, tl.loc('InvalidSettingsFile', settingsFile));
                throw Error((tl.loc('InvalidSettingsFile', settingsFile)));
            }
        }
    }

    if (vstestConfig.codeCoverageEnabled) {
        if (!utils.Helper.isToolsInstallerFlow(vstestConfig)) {
            argsArray.push('/EnableCodeCoverage');
        }
    }

    if (vstestConfig.runTestsInIsolation) {
        argsArray.push('/InIsolation');
    }

    argsArray.push('/logger:trx');
    if (utils.Helper.isNullOrWhitespace(vstestConfig.pathtoCustomTestAdapters)) {
        if (vstestConfig.testDropLocation && isTestAdapterPresent(vstestConfig.testDropLocation)) {
            argsArray.push('/TestAdapterPath:\"' + vstestConfig.testDropLocation + '\"');
        }
    } else {
        argsArray.push('/TestAdapterPath:\"' + vstestConfig.pathtoCustomTestAdapters + '\"');
    }

    if (utils.Helper.isDebugEnabled()) {
        if (vstestConfig.vsTestVersionDetails !== null && (vstestConfig.vsTestVersionDetails.vstestDiagSupported()
            || utils.Helper.isToolsInstallerFlow(vstestConfig))) {
            argsArray.push('/diag:' + vstestConfig.vstestDiagFile);
        } else {
            tl.warning(tl.loc('VstestDiagNotSupported'));
        }
    }

    return argsArray;
}

function addVstestArgs(argsArray: string[], vstest: any) {
    argsArray.forEach(function (arr: any) {
        vstest.arg(arr);
    });
}

function updateResponseFile(argsArray: string[], responseFile: string): boolean {

    if (!vstestConfig.responseFileSupported) {
        return false;
    }

    try {
        argsArray.forEach(function (arr, i) {
            argsArray[i] = utils.Helper.modifyVsTestConsoleArgsForResponseFile(arr);
        });

        let vsTestArgsString: string = os.EOL + argsArray.join(os.EOL);
        if (!utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
            vsTestArgsString = vsTestArgsString + os.EOL + vstestConfig.otherConsoleOptions;
        }

        fs.appendFileSync(responseFile, vsTestArgsString);
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.UPDATERESPONSEFILE, err.message, 1017, false);
        tl.error(err);
        tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', responseFile));
        return false;
    }
    return true;
}

function getTestSelectorLocation(): string {
    return path.join(__dirname, 'TestSelector/TestSelector.exe');
}

async function executeVstest(parallelRunSettingsFile: string, vsVersion: number, argsArray: string[], addOtherConsoleOptions: boolean): Promise<number> {
    let vstest = tl.tool(vstestConfig.vsTestVersionDetails.vstestExeLocation);

    //Re-calculate the results directory based on final runsettings and clean up again if required.
    resultsDirectory = getTestResultsDirectory(parallelRunSettingsFile, path.join(workingDirectory, 'TestResults'));
    tl.rmRF(resultsDirectory);
    tl.mkdirP(resultsDirectory);

    tl.cd(workingDirectory);
    const ignoreTestFailures = vstestConfig.ignoreTestFailures && vstestConfig.ignoreTestFailures.toLowerCase() === 'true';

    const envVars: { [key: string]: string; } = process.env;
    if (vstestConfig.rerunFailedTests) {
        vstest = tl.tool(path.join(__dirname, 'Modules/DTAExecutionHost.exe'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.VstestConsole', vstestConfig.vsTestVersionDetails.vstestExeLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestResultDirectory', resultsDirectory);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.Configuration', vstestConfig.buildConfig);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.Platform', vstestConfig.buildPlatform);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.Runname', vstestConfig.testRunTitle);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ExecutionMode', 'vstestexecution');
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.EnableConsoleLogs', 'true');
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TeamFoundationCollectionUri', tl.getVariable('System.TeamFoundationCollectionUri'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AccessToken', tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken']);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ProjectName', tl.getVariable('System.TeamProject'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.Owner', 'VsTest');
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.BuildId', tl.getVariable('Build.BuildId'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.BuildUri', tl.getVariable('Build.BuildUri'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ReleaseUri', tl.getVariable('Release.ReleaseUri'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ReleaseEnvironmentUri', tl.getVariable('Release.EnvironmentUri'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ResponseFile', vstestConfig.responseFile);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ResponseSupplementryFile', vstestConfig.responseSupplementryFile);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.VstestArgsFile', vstestConfig.vstestArgsFile);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.IsResponseFileRun', vstestConfig.isResponseFileRun.toString());
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.PublishTestResultsInTiaMode', vstestConfig.publishTestResultsInTiaMode.toString());
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TestSelector', path.join(__dirname, 'TestSelector/TestSelector.exe'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TiaContext', vstestConfig.tiaConfig.context);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.ReleaseId', tl.getVariable('Release.ReleaseId'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.TiaRunIdFile', vstestConfig.tiaConfig.runIdFile);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.AgentVersion', tl.getVariable('AGENT.VERSION'));
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.VstestTaskInstanceIdentifier', vstestConfig.taskInstanceIdentifier);
        utils.Helper.addToProcessEnvVars(envVars, 'DTA.RerunIterationCount', vstestConfig.rerunMaxAttempts.toString());
        if (vstestConfig.rerunType === 'basedOnTestFailureCount') {
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.RerunFailedTestCasesMaxLimit', vstestConfig.rerunFailedTestCasesMaxLimit.toString());
        } else {
            utils.Helper.addToProcessEnvVars(envVars, 'DTA.RerunFailedThreshold', vstestConfig.rerunFailedThreshold.toString());
        }
    } else {
        addVstestArgs(argsArray, vstest);
        // Adding the other console options here
        //   => Because it should be added as ".line" inorder to pass multiple parameters
        //   => Parsing will be taken care by .line
        // https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/vsts-task-lib.md#toolrunnerToolRunnerline
        if (addOtherConsoleOptions && !utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
            vstest.line(vstestConfig.otherConsoleOptions);
        }
    }

    utils.Helper.addToProcessEnvVars(envVars, 'Test.TestCaseAccessToken', tl.getVariable('Test.TestCaseAccessToken'));
    if (utils.Helper.isToolsInstallerFlow(vstestConfig)) {
        utils.Helper.addToProcessEnvVars(envVars, 'COR_PROFILER_PATH_32', vstestConfig.toolsInstallerConfig.x86ProfilerProxyDLLLocation);
        utils.Helper.addToProcessEnvVars(envVars, 'COR_PROFILER_PATH_64', vstestConfig.toolsInstallerConfig.x64ProfilerProxyDLLLocation);
    }

    const isBlockingCommands = await isFeatureFlagEnabled(tl.getVariable('System.TeamFoundationCollectionUri'),
        'TestExecution.EnableBlockedCommandInRestrictedMode', tl.getEndpointAuthorization('SystemVssConnection', true).parameters.AccessToken);

    const execOptions: tr.IExecOptions = <any>{
        ignoreReturnCode: ignoreTestFailures,
        env: envVars,
        failOnStdErr: false,
        // In effect this will not be called as failOnStdErr is false
        // Keeping this code in case we want to change failOnStdErr
        outStream: new outStream.StringErrorWritable(false, isBlockingCommands, { decodeStrings: false }),
        errStream: new outStream.StringErrorWritable(true, isBlockingCommands, { decodeStrings: false })
    };

    // The error codes return below are not the same as tl.TaskResult which follows a different convention.
    // Here we are returning the code as returned to us by vstest.console in case of complete run
    // In case of a failure 1 indicates error to our calling function
    try {
        var code = await vstest.exec(execOptions);
        cleanUp(parallelRunSettingsFile);
        if (ignoreTestFailures) {
            return 0; // ignore failures.
        } else {
            return code;
        }
    }
    catch (err) {
        cleanUp(parallelRunSettingsFile);
        tl.warning(tl.loc('VstestFailed'));
        if (ignoreTestFailures) {
            tl.warning(err);
            return 0;
        } else {
            utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, err.message, 1005, true);
            tl.error(err);
            return 1;
        }
    }
}

function getVstestTestsListInternal(vsVersion: number, testCaseFilter: string, outputFile: string): string {
    const tempFile = outputFile;
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

    try {
        testAssemblyFiles.forEach(function (testAssembly) {
            let testAssemblyPath = testAssembly;
            if (utils.Constants.systemDefaultWorkingDirectory && !utils.Helper.pathExistsAsFile(testAssembly)) {
                const expandedPath = path.join(utils.Constants.systemDefaultWorkingDirectory, testAssembly);
                if (utils.Helper.pathExistsAsFile(expandedPath)) {
                    testAssemblyPath = expandedPath;
                }
            }
            argsArray.push(testAssemblyPath);
        });

        tl.debug('The list of discovered tests is generated at ' + tempFile);

        argsArray.push('/ListFullyQualifiedTests');
        argsArray.push('/ListTestsTargetPath:' + tempFile);
        if (testCaseFilter) {
            argsArray.push('/TestCaseFilter:' + testCaseFilter);
        }
        if (vstestConfig.pathtoCustomTestAdapters) {
            if (utils.Helper.pathExistsAsDirectory(vstestConfig.pathtoCustomTestAdapters)) {
                argsArray.push('/TestAdapterPath:\"' + vstestConfig.pathtoCustomTestAdapters + '\"');
            } else {
                argsArray.push('/TestAdapterPath:\"' + path.dirname(vstestConfig.pathtoCustomTestAdapters) + '\"');
            }
        } else if (vstestConfig.testDropLocation && isTestAdapterPresent(vstestConfig.testDropLocation)) {
            argsArray.push('/TestAdapterPath:\"' + vstestConfig.testDropLocation + '\"');
        }

        if (vstestConfig.pathtoCustomTestAdapters && vstestConfig.pathtoCustomTestAdapters.toLowerCase().indexOf('usevsixextensions:true') !== -1) {
            argsArray.push('/UseVsixExtensions:true');
        }

        let vstest = tl.tool(vstestConfig.vsTestVersionDetails.vstestExeLocation);

        if (vsVersion === 14.0) {
            tl.debug('Visual studio 2015 selected. Selecting vstest.console.exe in task ');
            const vsTestPath = path.join(__dirname, 'TestSelector/14.0/vstest.console.exe') // Use private vstest as the changes to discover tests are not there in update3
            vstest = tl.tool(vsTestPath);
        }
        addVstestArgs(argsArray, vstest);

        // Adding the other console options here
        //   => Because it should be added as ".line" inorder to pass multiple parameters
        //   => Parsing will be taken care by .line
        // https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/vsts-task-lib.md#toolrunnerToolRunnerline
        if (!utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
            vstest.line(vstestConfig.otherConsoleOptions);
        }

        var vstestExecutionResult = vstest.execSync(<tr.IExecSyncOptions>{ cwd: workingDirectory });

        if (vstestExecutionResult.code != 0) {
            tl.debug('Listing tests from VsTest failed.');
            tl.error(vstestExecutionResult.error ? vstestExecutionResult.error.message : vstestExecutionResult.stderr);
            utils.Helper.publishEventToCi(AreaCodes.GETVSTESTTESTSLISTINTERNAL, vstestExecutionResult.error ? vstestExecutionResult.error.message : vstestExecutionResult.stderr, 1006, false);
            return vstestExecutionResult.error ? vstestExecutionResult.error.message : vstestExecutionResult.stderr;
        }

        console.log(vstestExecutionResult.stdout);
        return tempFile;
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.GETVSTESTTESTSLIST, err.message, 1027, false);
        tl.error(err);
        tl.warning(tl.loc('ErrorWhileListingDiscoveredTests'));
        throw err;
    }
}

function getVstestTestsList(vsVersion: number): string {
    const tempFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

    return getVstestTestsListInternal(vsVersion, vstestConfig.testcaseFilter, tempFile);
}

function uploadVstestDiagFile(): void {
    if (vstestConfig && vstestConfig.vstestDiagFile && utils.Helper.pathExistsAsFile(vstestConfig.vstestDiagFile)) {
        uploadFile(vstestConfig.vstestDiagFile);
        const files = tl.findMatch(utils.Helper.GetTempFolder(), ['*host.*.txt', '*datacollector.*.txt']);
        if (files) {
            files.forEach(file => {
                uploadFile(file);
            });
        }
    }
}

function uploadFile(file: string): void {
    try {
        if (utils.Helper.pathExistsAsFile(file)) {
            const stats = fs.statSync(file);
            tl.debug('File exists. Size: ' + stats.size + ' Bytes');
            console.log('##vso[task.uploadfile]' + file);
        }
    } catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.GETVSTESTTESTSLIST, err.message, 1029, false);
        tl.debug(err);
    }
}

function discoverTestFromFilteredFilter(vsVersion: number, testCaseFilterFile: string, testCaseFilterOutput: string): string {
    if (utils.Helper.pathExistsAsFile(testCaseFilterFile)) {
        let filters = utils.Helper.readFileContentsSync(testCaseFilterFile, 'utf-8');
        return getVstestTestsListInternal(vsVersion, filters, testCaseFilterOutput);
    }
}

async function runVStest(settingsFile: string, vsVersion: number): Promise<tl.TaskResult> {
    if (!isTiaAllowed()) {
        // Test Impact was not enabled
        return runVsTestAndUploadResultsNonTIAMode(settingsFile, vsVersion);
    }

    let testCaseFilterFile = '';
    let testCaseFilterOutput = '';
    let listFile = '';
    if (tiaConfig.userMapFile) {
        testCaseFilterFile = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
        testCaseFilterOutput = utils.Helper.GenerateTempFile(uuid.v1() + '.txt');
    }

    let testselector = new testselectorinvoker.TestSelectorInvoker();
    let code = testselector.publishCodeChanges(tiaConfig, vstestConfig.proxyConfiguration, testCaseFilterFile, vstestConfig.taskInstanceIdentifier);

    if (code !== 0) {
        // If publishing code changes fails, we run all tests. Here we are calling the non tia run because
        // the run was not yet created by TIA and we dont want to update the results via test selector
        tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
        return runVsTestAndUploadResultsNonTIAMode(settingsFile, vsVersion);
    }

    // Code changes were published successfully. We will create the run and populate it with discovered test cases now ->
    try {
        // Discovering the test cases and writing them to a file.
        listFile = getVstestTestsList(vsVersion);
        discoverTestFromFilteredFilter(vsVersion, testCaseFilterFile, testCaseFilterOutput);

        try {
            // This calls GetImpactedTests from test selector. Response file will contain the impacted tests in the format: /Tests:Method1,Method2
            testselector.generateResponseFile(tiaConfig, vstestConfig, listFile, testCaseFilterOutput);
        }
        catch (err) {
            utils.Helper.publishEventToCi(AreaCodes.GENERATERESPONSEFILE, err.message, 1024, false);
            tl.error(err);
            tl.warning(tl.loc('ErrorWhileCreatingResponseFile'));
            let updateResponseFileSuccess = updateResponseFile(getVstestArguments(settingsFile, true), vstestConfig.responseFile);
            return updateResponseFileSuccess ?
                runVsTestAndUploadResults(settingsFile, vsVersion, true, vstestConfig.responseFile, true) :
                runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
        }

        if (isEmptyResponseFile(tiaConfig.responseFile)) {
            // Empty response file indicates some issue. We run all tests here.
            tl.debug('Empty response file detected. All tests will be executed.');
            let updateResponseFileSuccess = updateResponseFile(getVstestArguments(settingsFile, true), vstestConfig.responseFile);
            return updateResponseFileSuccess ?
                runVsTestAndUploadResults(settingsFile, vsVersion, true, vstestConfig.responseFile, true) :
                runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
        }
        else {
            if (responseContainsNoTests(tiaConfig.responseFile)) {
                // Case where response file indicated no tests were impacted. E.g.: "/Tests:"
                tl.debug('No tests impacted. Not running any tests.');
                let updateTestResultsOutputCode = testselector.uploadTestResults(tiaConfig, vstestConfig, '');
                if (updateTestResultsOutputCode !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + updateTestResultsOutputCode, 1011, false);
                    return tl.TaskResult.Failed;
                }
                return tl.TaskResult.Succeeded;
            }
            else {
                let updateResponseFileSuccess = updateResponseFile(getVstestArguments(settingsFile, false), tiaConfig.responseFile);
                if (updateResponseFileSuccess && vstestConfig.testcaseFilter) tl.debug('Ignoring TestCaseFilter in response file because Test Impact is enabled');

                return updateResponseFileSuccess ?
                    runVsTestAndUploadResults(settingsFile, vsVersion, true, tiaConfig.responseFile, true) :
                    runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
            }
        }
    }
    catch (err) {
        // The errors and logging tasks are handled in individual calls before. Just failing the task here
        return tl.TaskResult.Failed;
    }
}

async function runVsTestAndUploadResults(settingsFile: string, vsVersion: number, isResponseFileRun: boolean, updatedResponseFile: string, uploadTiaResults: boolean): Promise<tl.TaskResult> {
    var vstestArgs;
    let testselector = new testselectorinvoker.TestSelectorInvoker();

    if (isResponseFileRun) {
        vstestArgs = ['@' + updatedResponseFile];
        vstestConfig.responseFile = updatedResponseFile;
        vstestConfig.isResponseFileRun = true;
    }
    else {
        vstestArgs = getVstestArguments(settingsFile, true);
    }

    vstestConfig.publishTestResultsInTiaMode = uploadTiaResults;
    let updateResponseSupplementryFileSuccess = isResponseFileRun && updateResponseFile(getVstestArguments(settingsFile, false), vstestConfig.responseSupplementryFile);
    if (!updateResponseSupplementryFileSuccess && vstestConfig.rerunFailedTests) {
        tl.warning(tl.loc('rerunNotSupported'));
        vstestConfig.rerunFailedTests = false;
    }

    try {
        var vscode = await executeVstest(settingsFile, vsVersion, vstestArgs, !isResponseFileRun);
        let updateTestResultsOutputCode: number;
        if (uploadTiaResults && !vstestConfig.rerunFailedTests) {
            updateTestResultsOutputCode = testselector.uploadTestResults(tiaConfig, vstestConfig, resultsDirectory);
        }
        if (vscode !== 0 || (uploadTiaResults && !vstestConfig.rerunFailedTests && updateTestResultsOutputCode !== 0)) {
            utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, ResultMessages.EXECUTEVSTESTRETURNED + vscode, 1010, false);
            return tl.TaskResult.Failed;
        }
        return tl.TaskResult.Succeeded;
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, err.message, 1010, false);
        tl.error(err)
        return tl.TaskResult.Failed;
    }
}

async function runVsTestAndUploadResultsNonTIAMode(settingsFile: string, vsVersion: number): Promise<tl.TaskResult> {
    let updateResponseFileSuccess = updateResponseFile(getVstestArguments(settingsFile, true), vstestConfig.responseFile);
    if (!updateResponseFileSuccess) {
        return runVsTestAndUploadResults(settingsFile, vsVersion, false, '', false).then(function (runResult) {
            if (!vstestConfig.rerunFailedTests) {
                let publishResult = publishTestResults(resultsDirectory);
                return (runResult === tl.TaskResult.Failed || publishResult === tl.TaskResult.Failed) ?
                    tl.TaskResult.Failed :
                    tl.TaskResult.Succeeded;
            }
            return runResult;
        });
    }

    return runVsTestAndUploadResults(settingsFile, vsVersion, true, vstestConfig.responseFile, false)
        .then(function (runResult) {
            if (!vstestConfig.rerunFailedTests) {
                let publishResult = publishTestResults(resultsDirectory);
                return (runResult === tl.TaskResult.Failed || publishResult === tl.TaskResult.Failed) ?
                    tl.TaskResult.Failed :
                    tl.TaskResult.Succeeded;
            }
            return runResult;
        }).catch(function (err) {
            tl.error(err);
            return tl.TaskResult.Failed;
        });
}

async function invokeVSTest(): Promise<tl.TaskResult> {
    try {
        const disableTIA = tl.getVariable('DisableTestImpactAnalysis');
        if (disableTIA !== undefined && disableTIA.toLowerCase() === 'true') {
            tl.debug('Disabling tia.');
            tiaConfig.tiaEnabled = false;
        }

        if (tiaConfig.tiaEnabled && (vstestConfig.vsTestVersionDetails === null
            || (!vstestConfig.vsTestVersionDetails.isTestImpactSupported() && !(utils.Helper.isToolsInstallerFlow(vstestConfig))))) {
            tl.warning(tl.loc('VstestTIANotSupported'));
            tiaConfig.tiaEnabled = false;
        }
    } catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.TIACONFIG, err.message, 1032, false);
        tl.error(err.message);
        throw err;
    }

    // We need to use private data collector dll
    if (vstestConfig.vsTestVersionDetails !== null) {
        tiaConfig.useNewCollector = vstestConfig.vsTestVersionDetails.isPrivateDataCollectorNeededForTIA();
    }

    setRunInParallellIfApplicable();
    let newSettingsFile = vstestConfig.settingsFile;
    const vsVersion = vstestConfig.vsTestVersionDetails.majorVersion;

    if (newSettingsFile) {
        if (!utils.Helper.pathExistsAsFile(newSettingsFile)) {
            if (!tl.exist(newSettingsFile)) { // because this is filepath input build puts default path in the input. To avoid that we are checking this.
                utils.Helper.publishEventToCi(AreaCodes.TIACONFIG, 'InvalidSettingsFile', 1033, true);
                throw Error((tl.loc('InvalidSettingsFile', newSettingsFile)));
            }
        }
    }

    try {
        newSettingsFile = await settingsHelper.updateSettingsFileAsRequired(vstestConfig.settingsFile, vstestConfig.runInParallel, vstestConfig.tiaConfig,
            vstestConfig.vsTestVersionDetails, false, vstestConfig.overrideTestrunParameters, false, vstestConfig.codeCoverageEnabled && utils.Helper.isToolsInstallerFlow(vstestConfig));
        return vsTestCall(newSettingsFile, vsVersion);
    }
    catch (err) {
        //Should continue to run without the selected configurations.
        throw err;
    }
}

async function vsTestCall(newSettingsFile, vsVersion): Promise<tl.TaskResult> {
    return runVStest(newSettingsFile, vsVersion).then(function (code) {
        if (code !== 0) {
            utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, 'RunVStest returned ' + code, 1036, false);
            return tl.TaskResult.Failed;
        }
        return tl.TaskResult.Succeeded;
    }).catch(function (err) {
        utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, err.message, 1037, false);
        tl.error(err);
        return tl.TaskResult.Failed;
    });
}

function publishTestResults(testResultsDirectory: string): tl.TaskResult {
    try {
        if (testResultsDirectory) {
            const resultFiles = tl.findMatch(testResultsDirectory, path.join(testResultsDirectory, '*.trx'));

            if (resultFiles && resultFiles.length !== 0) {
                const tp = new tl.TestPublisher('VSTest');
                tp.publish(resultFiles, 'false', vstestConfig.buildPlatform, vstestConfig.buildConfig, vstestConfig.testRunTitle, vstestConfig.publishRunAttachments);
            } else {
                console.log('##vso[task.logissue type=warning;code=002003;]');
                tl.warning(tl.loc('NoResultsToPublish'));
            }
        } else {
            utils.Helper.publishEventToCi(AreaCodes.PUBLISHRESULTS, 'no test directory', 1041, false);
            tl.warning(tl.loc('NoTestResultsDirectoryFound'));
        }

        return tl.TaskResult.Succeeded;
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.PUBLISHRESULTS, err.message, 1040, false);
        tl.error(err);
        return tl.TaskResult.Failed;
    }
}

function cleanUp(temporarySettingsFile: string): void {
    //cleanup the runsettings file
    if (temporarySettingsFile && vstestConfig.settingsFile !== temporarySettingsFile) {
        try {
            tl.rmRF(temporarySettingsFile);
        } catch (error) {
            //ignore. just cleanup.
        }
    }
}

function isTestAdapterPresent(rootDirectory: string): boolean {
    const adapterFiles = tl.findMatch(rootDirectory, '**\\*TestAdapter.dll');

    if (adapterFiles && adapterFiles.length !== 0) {
        return true;
    }
    return false;
}

function getTestResultsDirectory(settingsFile: string, defaultResultsDirectory: string): string {
    let resultDirectory = defaultResultsDirectory;

    if (!settingsFile || !utils.Helper.pathExistsAsFile(settingsFile)) {
        return resultDirectory;
    }

    try {
        const xmlContents = utils.Helper.readFileContentsSync(settingsFile, 'utf-8');
        const parser = new xml2js.Parser();

        parser.parseString(xmlContents, function (err, result) {
            if (!err && result.RunSettings && result.RunSettings.RunConfiguration && result.RunSettings.RunConfiguration[0] &&
                result.RunSettings.RunConfiguration[0].ResultsDirectory && result.RunSettings.RunConfiguration[0].ResultsDirectory[0].length > 0) {
                let runSettingsResultDirectory = result.RunSettings.RunConfiguration[0].ResultsDirectory[0];
                runSettingsResultDirectory = runSettingsResultDirectory.trim();

                if (runSettingsResultDirectory) {
                    // path.resolve will take care if the result directory given in settings files is not absolute.
                    resultDirectory = path.resolve(path.dirname(settingsFile), runSettingsResultDirectory);
                }
            }
        });
    } catch (error) {
        //In case of error return default directory.
        tl.debug(error);
        return resultDirectory;
    }

    return resultDirectory;
}

function setRunInParallellIfApplicable() {
    if (vstestConfig.runInParallel) {
        if (vstestConfig.vsTestVersionDetails != null && vstestConfig.vsTestVersionDetails.isRunInParallelSupported()) {
            return;
        }

        // 2015 Update3 needed for run in parallel.
        tl.warning(tl.loc('UpdateThreeOrHigherRequired'));
        vstestConfig.runInParallel = false;
    }
}

function isEmptyResponseFile(responseFile: string): boolean {
    if (utils.Helper.pathExistsAsFile(responseFile) && tl.stats(responseFile).size) {
        return false;
    }
    return true;
}

function isTiaAllowed(): boolean {
    if (tiaConfig.tiaEnabled && getTestSelectorLocation()) {
        return true;
    }
    return false;
}

function responseContainsNoTests(filePath: string): boolean {
    try {
        let resp = utils.Helper.readFileContentsSync(filePath, 'utf-8');
        if (resp === '/Tests:"' || resp === '/Tests:' || resp === '/TestCaseFilter:') {
            return true;
        } else {
            return false;
        }
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.RESPONSECONTAINSNOTESTS, err.message, 1023, false);
        tl.error(err);
        throw err;
    }
} 