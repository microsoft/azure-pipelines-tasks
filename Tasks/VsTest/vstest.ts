import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import path = require('path');
import Q = require('q');
import models = require('./models');
import taskInputParser = require('./taskinputparser');
import settingsHelper = require('./settingshelper');
import vstestVersion = require('./vstestversion');
import * as utils from './helpers';
import * as outStream from './outputstream';
import * as ci from './cieventlogger';
import * as testselectorinvoker from './testselectorinvoker';
import { AreaCodes, ResultMessages } from './constants';
import { ToolRunner } from 'vsts-task-lib/toolrunner';
let os = require('os');
let regedit = require('regedit');
let uuid = require('uuid');
let fs = require('fs');
let xml2js = require('xml2js');
let perf = require('performance-now');
let process = require('process');

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
            throw(error);
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

        invokeVSTest().then(function (taskResult) {
            uploadVstestDiagFile();
            if (taskResult == tl.TaskResult.Failed) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('VstestFailedReturnCode'));
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc('VstestPassedReturnCode'));
            }
        }).catch(function (err) {
            uploadVstestDiagFile();
            utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, err.message, 1002, false);
            console.log('##vso[task.logissue type=error;code=' + err + ';TaskName=VSTest]');
            tl.setResult(tl.TaskResult.Failed, err);
        });
    } catch (error) {
        uploadVstestDiagFile();
        utils.Helper.publishEventToCi(AreaCodes.RUNTESTSLOCALLY, error.message, 1003, false);
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

function getTestAssemblies(): string[] {
    tl.debug('Searching for test assemblies in: ' + vstestConfig.testDropLocation);
    return tl.findMatch(vstestConfig.testDropLocation, vstestConfig.sourceFilter);
}

function getVstestArguments(settingsFile: string, tiaEnabled: boolean): string[] {
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
    if (vstestConfig.testcaseFilter) {
        if (!tiaEnabled) {
            argsArray.push('/TestCaseFilter:' + vstestConfig.testcaseFilter);
        } else {
            tl.debug('Ignoring TestCaseFilter because Test Impact is enabled');
        }
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
        argsArray.push('/EnableCodeCoverage');
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

    if (isDebugEnabled()) {
        if (vstestConfig.vsTestVersionDetails != null && vstestConfig.vsTestVersionDetails.vstestDiagSupported()) {
            argsArray.push('/diag:' + vstestConfig.vstestDiagFile);
        } else {
            tl.warning(tl.loc('VstestDiagNotSupported'));
        }
    }

    return argsArray;

}

function isDebugEnabled(): boolean {
    const sysDebug = tl.getVariable('System.Debug');
    if (sysDebug === undefined) {
        return false;
    }

    return sysDebug.toLowerCase() === 'true';
}

function addVstestArgs(argsArray: string[], vstest: any) {
    argsArray.forEach(function (arr: any) {
        vstest.arg(arr);
    });
}

function updateResponseFile(argsArray: string[], tiaMode: boolean = true): void {
    argsArray.forEach(function (arr, i) {
        argsArray[i] = utils.Helper.modifyVsTestConsoleArgsForResponseFile(arr);
    });

    let vsTestArgsString: string = os.EOL + argsArray.join(os.EOL);
    if (!utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
        vsTestArgsString = vsTestArgsString + os.EOL + vstestConfig.otherConsoleOptions;
    }

    if (tiaMode) {
        fs.appendFileSync(tiaConfig.responseFile, vsTestArgsString);
    }
    else {
        fs.appendFileSync(vstestConfig.responseFile, vsTestArgsString);
    }
}

function getTestSelectorLocation(): string {
    return path.join(__dirname, 'TestSelector/TestSelector.exe');
}

function executeVstest(parallelRunSettingsFile: string, vsVersion: number, argsArray: string[], addOtherConsoleOptions: boolean): Q.Promise<number> {
    const vstest = tl.tool(vstestConfig.vsTestVersionDetails.vstestExeLocation);
    addVstestArgs(argsArray, vstest);

    // Adding the other console options here
    //   => Because it should be added as ".line" inorder to pass multiple parameters
    //   => Parsing will be taken care by .line
    // https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/vsts-task-lib.md#toolrunnerToolRunnerline
    if (addOtherConsoleOptions && !utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
        vstest.line(vstestConfig.otherConsoleOptions);
    }

    //Re-calculate the results directory based on final runsettings and clean up again if required.
    resultsDirectory = getTestResultsDirectory(parallelRunSettingsFile, path.join(workingDirectory, 'TestResults'));
    tl.rmRF(resultsDirectory);
    tl.mkdirP(resultsDirectory);

    tl.cd(workingDirectory);
    const ignoreTestFailures = vstestConfig.ignoreVstestFailure && vstestConfig.ignoreVstestFailure.toLowerCase() === 'true';

    const execOptions: tr.IExecOptions = <any>{
        ignoreReturnCode: ignoreTestFailures,
        failOnStdErr: false,
        // In effect this will not be called as failOnStdErr is false
        // Keeping this code in case we want to change failOnStdErr
        errStream: new outStream.StringErrorWritable({ decodeStrings: false })
    };
    return vstest.exec(execOptions).then(function (code) {
        cleanUp(parallelRunSettingsFile);
        if (ignoreTestFailures) {
            return 0; // ignore failures.
        } else {
            return code;
        }
    }).catch(function (err) {
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
    });
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
    const tempFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

    return getVstestTestsListInternal(vsVersion, vstestConfig.testcaseFilter, tempFile);
}

function uploadVstestDiagFile(): void {
    if (vstestConfig && vstestConfig.vstestDiagFile && utils.Helper.pathExistsAsFile(vstestConfig.vstestDiagFile)) {
        let stats = fs.statSync(vstestConfig.vstestDiagFile);
        tl.debug('Diag file exists. Size: ' + stats.size + ' Bytes');
        console.log('##vso[task.uploadfile]' + vstestConfig.vstestDiagFile);
    }
}

function discoverTestFromFilteredFilter(vsVersion: number, testCaseFilterFile: string, testCaseFilterOutput: string): string {
    if (utils.Helper.pathExistsAsFile(testCaseFilterFile)) {
        let filters = utils.Helper.readFileContentsSync(testCaseFilterFile, 'utf-8');
        return getVstestTestsListInternal(vsVersion, filters, testCaseFilterOutput);
    }
}

function runVStest(settingsFile: string, vsVersion: number): Q.Promise<tl.TaskResult> {
    if (!isTiaAllowed()) {
        // Test Impact was not enabled
        return runVsTestAndUploadResultsNonTIAMode(settingsFile, vsVersion);
    }
    
    let testCaseFilterFile = "";
    let testCaseFilterOutput = "";
    let listFile = "";
    if (tiaConfig.userMapFile) {
        testCaseFilterFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
        testCaseFilterOutput = path.join(os.tmpdir(), uuid.v1() + '.txt');
    }

    let testselector = new testselectorinvoker.TestSelectorInvoker();
    let code = testselector.publishCodeChanges(tiaConfig, testCaseFilterFile, vstestConfig.taskInstanceIdentifier);

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
            return runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
        }

        if (isEmptyResponseFile(tiaConfig.responseFile)) {
            // Empty response file indicates some issue. We run all tests here.
            tl.debug('Empty response file detected. All tests will be executed.');
            return runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
        }
        else {
            if (responseContainsNoTests(tiaConfig.responseFile)) {
                // Case where response file indicated no tests were impacted. E.g.: "/Tests:"
                tl.debug('No tests impacted. Not running any tests.');
                let updateTestResultsOutputCode = testselector.uploadTestResults(tiaConfig, vstestConfig, '');
                if (updateTestResultsOutputCode !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + updateTestResultsOutputCode, 1011, false);
                    return Q.resolve(tl.TaskResult.Failed);
                }
                return Q.resolve(tl.TaskResult.Succeeded);
            }
            else {
                // Response file indicates that only few tests were impacted E.g.: "/Tests:MyNamespace.MyClass.TestMethod1"
                try {
                    updateResponseFile(getVstestArguments(settingsFile, true));
                }
                catch (err) {
                    utils.Helper.publishEventToCi(AreaCodes.UPDATERESPONSEFILE, err.message, 1017, false);
                    tl.error(err);
                    tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', tiaConfig.responseFile));
                    return runVsTestAndUploadResults(settingsFile, vsVersion, false, '', true);
                }

                return runVsTestAndUploadResults(settingsFile, vsVersion, true, tiaConfig.responseFile, true);
            }
        }
    }
    catch (err) {
        // The errors and logging tasks are handled in individual calls before. Just failing the task here
        return Q.resolve(tl.TaskResult.Failed);
    }
}

function runVsTestAndUploadResults(settingsFile: string, vsVersion: number, isResponseFileRun: boolean, updatedFile?: string, uploadResults?: boolean): Q.Promise<tl.TaskResult> {
    var vstestArgs;
    let testselector = new testselectorinvoker.TestSelectorInvoker();

    if (isResponseFileRun) {
        vstestArgs = ['@' + updatedFile];
    }
    else {
        vstestArgs = getVstestArguments(settingsFile, false);
    }

    return executeVstest(settingsFile, vsVersion, vstestArgs, !isResponseFileRun).then(function (vscode) {
        let updateTestResultsOutputCode: number;
        if (uploadResults) {
            updateTestResultsOutputCode = testselector.uploadTestResults(tiaConfig, vstestConfig, resultsDirectory);
        }
        if (vscode !== 0 || (uploadResults && updateTestResultsOutputCode !== 0)) {
            utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, ResultMessages.EXECUTEVSTESTRETURNED + vscode, 1010, false);
            return Q.resolve(tl.TaskResult.Failed);
        }
        return Q.resolve(tl.TaskResult.Succeeded);
    }).catch(function (err) {
        utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, err.message, 1010, false);
        tl.error(err)
        return tl.TaskResult.Failed;
    });
}

function runVsTestAndUploadResultsNonTIAMode(settingsFile: string, vsVersion: number): Q.Promise<tl.TaskResult> {
    try {
        updateResponseFile(getVstestArguments(settingsFile, false), false);
    }
    catch (err) {
        utils.Helper.publishEventToCi(AreaCodes.UPDATERESPONSEFILE, err.message, 1017, false);
        tl.error(err);
        tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', tiaConfig.responseFile));
        return runVsTestAndUploadResults(settingsFile, vsVersion, false, '', false).then(function () {
            return publishTestResults(resultsDirectory);
        });
    }

    return runVsTestAndUploadResults(settingsFile, vsVersion, vstestConfig.responseFileSupported, vstestConfig.responseFile, false).then(function (runResult) {
        let publishResult = publishTestResults(resultsDirectory);
        if (runResult === tl.TaskResult.Failed || publishResult === tl.TaskResult.Failed) {
            return tl.TaskResult.Failed;
        }
        return tl.TaskResult.Succeeded;
    }).catch(function (err) {
        tl.error(err);
        return tl.TaskResult.Failed;
    });
}

function invokeVSTest(): Q.Promise<tl.TaskResult> {
    try {
        const disableTIA = tl.getVariable('DisableTestImpactAnalysis');
        if (disableTIA !== undefined && disableTIA.toLowerCase() === 'true') {
            tiaConfig.tiaEnabled = false;
        }

        if (tiaConfig.tiaEnabled && (vstestConfig.vsTestVersionDetails === null || !vstestConfig.vsTestVersionDetails.isTestImpactSupported())) {
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
        newSettingsFile = settingsHelper.updateSettingsFileAsRequired(vstestConfig.settingsFile, vstestConfig.runInParallel, vstestConfig.tiaConfig, vstestConfig.vsTestVersionDetails, false, vstestConfig.overrideTestrunParameters, false);
        return vsTestCall(newSettingsFile, vsVersion);
    }
    catch (err) {
        //Should continue to run without the selected configurations.
        return vsTestCall(newSettingsFile, vsVersion);
    }
}

function vsTestCall(newSettingsFile, vsVersion): Q.Promise<tl.TaskResult> {
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
