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
            tl.setResult(tl.TaskResult.Failed, error);
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

        invokeVSTest(resultsDirectory)
            .then(function (code) {
                try {
                    if (!isTiaAllowed()) {
                        publishTestResults(resultsDirectory);
                    }
                    uploadVstestDiagFile();
                    tl.setResult(code, tl.loc('VstestReturnCode', code));                    
                } catch (error) {
                    uploadVstestDiagFile();
                    utils.Helper.publishEventToCi(AreaCodes.PUBLISHRESULTS, error.message, 1001, false);
                    console.log('##vso[task.logissue type=error;code=' + error + ';TaskName=VSTest]');
                    throw error; // This throw should be removed
                }
            })
            .fail(function (err) {
                uploadVstestDiagFile();
                utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, err.message, 1002, false);
                console.log('##vso[task.logissue type=error;code=' + err + ';TaskName=VSTest]');
                throw err;  // What is the point of this throw? Where is it getting caught?
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

function updateResponseFile(argsArray: string[], responseFile: string): Q.Promise<string> {
    const defer = Q.defer<string>();
    argsArray.forEach(function (arr, i) {
        argsArray[i] = utils.Helper.modifyVsTestConsoleArgsForResponseFile(arr);
    });

    let vsTestArgsString : string = os.EOL + argsArray.join(os.EOL);
    if (!utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
        vsTestArgsString = vsTestArgsString + os.EOL + vstestConfig.otherConsoleOptions;
    }

    fs.appendFile(responseFile, vsTestArgsString, function (err) {
        if (err) {
            defer.reject(err);
        }
        defer.resolve(responseFile);
    });
    return defer.promise;
}

function getTestSelectorLocation(): string {
    return path.join(__dirname, 'TestSelector/TestSelector.exe');
}

function uploadTestResults(testResultsDirectory: string): Q.Promise<string> {
    const startTime = perf();
    let endTime;
    let elapsedTime;
    let definitionRunId: string;
    let resultFile: string;
    const defer = Q.defer<string>();
    let resultFiles;
    if (!utils.Helper.isNullOrWhitespace(testResultsDirectory)) {
        resultFiles = tl.findMatch(testResultsDirectory, path.join(testResultsDirectory, '*.trx'));
    }

    const selectortool = tl.tool(getTestSelectorLocation());
    selectortool.arg('UpdateTestResults');

    if (tiaConfig.context === 'CD') {
        definitionRunId = tl.getVariable('Release.ReleaseId');
    } else {
        definitionRunId = tl.getVariable('Build.BuildId');
    }

    if (resultFiles && resultFiles[0]) {
        resultFile = resultFiles[0];
    }

    selectortool.exec({
        cwd: null,
        env: {
            'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
            'projectid': tl.getVariable('System.TeamProject'),
            'definitionrunid': definitionRunId,
            'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            'resultfile': resultFile,
            'runidfile': tiaConfig.runIdFile,
            'context': tiaConfig.context,
            'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
            'VsTest_TaskInstanceIdentifier': vstestConfig.taskInstanceIdentifier
        },
        silent: null,
        failOnStdErr: null,
        ignoreReturnCode: null,
        outStream: null,
        errStream: null,
        windowsVerbatimArguments: null
    })
        .then(function (code) {
            endTime = perf();
            elapsedTime = endTime - startTime;
            console.log('##vso[task.logissue type=warning;SubTaskName=UploadTestResults;SubTaskDuration=' + elapsedTime + ']');
            tl.debug(tl.loc('UploadTestResultsPerfTime', elapsedTime));
            defer.resolve(String(code));
        })
        .fail(function (err) {
            defer.reject(err);
        });
    return defer.promise;
}

function generateResponseFile(discoveredTests: string, testCaseFilterOutputFile: string): Q.Promise<string> {
    const startTime = perf();
    let endTime: number;
    let elapsedTime: number;
    let definitionRunId: string;
    let title: string;
    let platformInput: string;
    let configurationInput: string;
    let useTestCaseFilterInResponseFile: string;
    const defer = Q.defer<string>();
    const respFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tl.debug('Response file will be generated at ' + respFile);
    tl.debug('RunId file will be generated at ' + tiaConfig.runIdFile);
    const selectortool = tl.tool(getTestSelectorLocation());
    selectortool.arg('GetImpactedtests');

    if (tiaConfig.context === 'CD') {
        // Release context. Passing Release Id.
        definitionRunId = tl.getVariable('Release.ReleaseId');
    } else {
        // Build context. Passing build id.
        definitionRunId = tl.getVariable('Build.BuildId');
    }

    if (vstestConfig.buildPlatform) {
        platformInput = vstestConfig.buildPlatform;
    } else {
        platformInput = '';
    }

    if (vstestConfig.testRunTitle) {
        title = vstestConfig.testRunTitle;
    } else {
        title = '';
    }

    if (vstestConfig.buildConfig) {
        configurationInput = vstestConfig.buildConfig;
    } else {
        configurationInput = '';
    }

    if (tiaConfig.useTestCaseFilterInResponseFile && tiaConfig.useTestCaseFilterInResponseFile.toUpperCase() === 'TRUE') {
        useTestCaseFilterInResponseFile = 'true';
    } else {
        useTestCaseFilterInResponseFile = 'false';
    }

    selectortool.exec({
        cwd: null,
        env: {
            'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
            'projectid': tl.getVariable('System.TeamProject'),
            'definitionrunid': definitionRunId,
            'releaseuri': tl.getVariable('release.releaseUri'),
            'releaseenvuri': tl.getVariable('release.environmentUri'),
            'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            'responsefilepath': respFile,
            'discoveredtestspath': discoveredTests,
            'runidfilepath': tiaConfig.runIdFile,
            'testruntitle': title,
            'baselinebuildfilepath': tiaConfig.baseLineBuildIdFile,
            'context': tiaConfig.context,
            'platform': platformInput,
            'configuration': configurationInput,
            'useTestCaseFilterInResponseFile': useTestCaseFilterInResponseFile,
            'testCaseFilterOutputFile' : testCaseFilterOutputFile ? testCaseFilterOutputFile : "",
            'isCustomEngineEnabled' : String(!utils.Helper.isNullOrWhitespace(tiaConfig.userMapFile)),
            'AGENT_VERSION': tl.getVariable('AGENT.VERSION'),
            'VsTest_TaskInstanceIdentifier': vstestConfig.taskInstanceIdentifier
        },
        silent: null,
        failOnStdErr: null,
        ignoreReturnCode: null,
        outStream: null,
        errStream: null,
        windowsVerbatimArguments: null
    })
        .then(function (code) {
            endTime = perf();
            elapsedTime = endTime - startTime;
            tl.debug(tl.loc('GenerateResponseFilePerfTime', elapsedTime));
            defer.resolve(respFile);
        })
        .fail(function (err) {
            defer.reject(err);
        });

    return defer.promise;
}

function executeVstest(testResultsDirectory: string, parallelRunSettingsFile: string, vsVersion: number, argsArray: string[], addOtherConsoleOptions: boolean): Q.Promise<number> {
    const defer = Q.defer<number>();
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
    vstest.exec(execOptions)
        .then(function (code) {
            cleanUp(parallelRunSettingsFile);
            if (ignoreTestFailures === true) {
                defer.resolve(tl.TaskResult.Succeeded); // ignore failures.
            } else {
                defer.resolve(code);
            }
        })
        .fail(function (err) {
            cleanUp(parallelRunSettingsFile);
            tl.warning(tl.loc('VstestFailed'));
            if (ignoreTestFailures) {
                tl.warning(err);
                defer.resolve(tl.TaskResult.Succeeded);
            } else {
                utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, err.message, 1005, true);
                tl.error(err);
                defer.resolve(tl.TaskResult.Failed);
            }
        });
    return defer.promise;
}

function getVstestTestsListInternal(vsVersion: number, testCaseFilter: string, outputFile: string): Q.Promise<string> {
    const defer = Q.defer<string>();
    const tempFile = outputFile;
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

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

    tl.cd(workingDirectory);
    vstest.exec(<tr.IExecOptions>{ failOnStdErr: true })
        .then(function (code) {
            defer.resolve(tempFile);
        })
        .fail(function (err) {
            tl.debug('Listing tests from VsTest failed.');
            utils.Helper.publishEventToCi(AreaCodes.GETVSTESTTESTSLISTINTERNAL, err.message, 1006, false);
            tl.error(err);
            defer.resolve(err);
        });
    return defer.promise;
}

function getVstestTestsList(vsVersion: number): Q.Promise<string> {
    const defer = Q.defer<string>();
    const tempFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

    return getVstestTestsListInternal(vsVersion, vstestConfig.testcaseFilter, tempFile);
}

function cleanFiles(responseFile: string, listFile: string, testCaseFilterFile: string, testCaseFilterOutput: string): void {
    tl.debug('Deleting the response file ' + responseFile);
    tl.rmRF(responseFile);
    tl.debug('Deleting the discovered tests file ' + listFile);
    tl.rmRF(listFile);
    tl.debug('Deleting the baseline build id file ' + tiaConfig.baseLineBuildIdFile);
    tl.rmRF(tiaConfig.baseLineBuildIdFile);
    tl.debug('Deleting test case filter file ' + testCaseFilterFile);
    tl.rmRF(testCaseFilterFile);
    tl.debug('Deleting test case filter output file' + testCaseFilterOutput);
    tl.rmRF(testCaseFilterOutput);
}

function uploadVstestDiagFile(): void {
    if (vstestConfig && vstestConfig.vstestDiagFile && utils.Helper.pathExistsAsFile(vstestConfig.vstestDiagFile)) {
        let stats = fs.statSync(vstestConfig.vstestDiagFile);        
        tl.debug('Diag file exists. Size: ' + stats.size + ' Bytes');
        console.log('##vso[task.uploadfile]'+ vstestConfig.vstestDiagFile);
    }
}

function discoverTestFromFilteredFilter(vsVersion: number, testCaseFilterFile: string, testCaseFilterOutput: string) {
    if (utils.Helper.pathExistsAsFile(testCaseFilterFile)) {
        let filters = utils.Helper.readFileContentsSync(testCaseFilterFile, 'utf-8');
        getVstestTestsListInternal(vsVersion, filters, testCaseFilterOutput);
    }
}

function runVStest(testResultsDirectory: string, settingsFile: string, vsVersion: number): Q.Promise<number> {
    const defer = Q.defer<number>();
    if (isTiaAllowed()) {
        let testCaseFilterFile = "";
        let testCaseFilterOutput = "";
        if (tiaConfig.userMapFile) {
            testCaseFilterFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
            testCaseFilterOutput = path.join(os.tmpdir(), uuid.v1() + '.txt');
        }

        let testselector = new testselectorinvoker.TestSelectorInvoker();
        let code = testselector.publishCodeChanges(tiaConfig, testCaseFilterFile, vstestConfig.taskInstanceIdentifier);
        if (code === 0) {
                getVstestTestsList(vsVersion)
                    .then(function (listFile) {
                        discoverTestFromFilteredFilter(vsVersion, testCaseFilterFile, testCaseFilterOutput);
                        generateResponseFile(listFile, testCaseFilterOutput)
                            .then(function (responseFile) {
                                if (isEmptyResponseFile(responseFile)) {
                                    tl.debug('Empty response file detected. All tests will be executed.');
                                    executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false), true)
                                        .then(function (vscode) {
                                            uploadTestResults(testResultsDirectory)
                                                .then(function (code) {
                                                    if (!isNaN(+code) && +code !== 0) {
                                                        utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + code, 1007, false);
                                                        defer.resolve(+code);
                                                    } else if (vscode !== 0) {
                                                        utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + String(vscode), 1008, false);
                                                        defer.resolve(vscode);
                                                    }

                                                    defer.resolve(tl.TaskResult.Succeeded);
                                                })
                                                .fail(function (code) {
                                                    tl.debug('Test Run Updation failed!');
                                                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.TESTRUNUPDATIONFAILED, 1009, false);
                                                    defer.resolve(tl.TaskResult.Failed);
                                                })
                                                .finally(function () {
                                                    cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                    tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                    tl.rmRF(tiaConfig.runIdFile);
                                                });
                                        })
                                        .fail(function (code) {
                                            if (code !== 0) {
                                                utils.Helper.publishEventToCi(AreaCodes.EXECUTEVSTEST, ResultMessages.EXECUTEVSTESTRETURNED + String(code), 1010, false);
                                            }
                                            defer.resolve(code);
                                        })
                                        .finally(function () {
                                            cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                        });
                                } else {
                                    responseContainsNoTests(responseFile)
                                        .then(function (noTestsAvailable) {
                                            if (noTestsAvailable) {
                                                tl.debug('No tests impacted. Not running any tests.');
                                                uploadTestResults('')
                                                    .then(function (code) {
                                                        if (!isNaN(+code) && +code !== 0) {
                                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + code, 1011, false);
                                                            defer.resolve(+code);
                                                        }
                                                        defer.resolve(tl.TaskResult.Succeeded);
                                                    })
                                                    .fail(function (code) {
                                                        tl.debug('Test Run Updation failed!');
                                                        utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.TESTRUNUPDATIONFAILED, 1012, false);
                                                        defer.resolve(tl.TaskResult.Failed);
                                                    })
                                                    .finally(function () {
                                                        cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                        tl.rmRF(tiaConfig.runIdFile);
                                                    });
                                            } else {
                                                updateResponseFile(getVstestArguments(settingsFile, true), responseFile)
                                                    .then(function (updatedFile) {
                                                        executeVstest(testResultsDirectory, settingsFile, vsVersion, ['@' + updatedFile], false)
                                                            .then(function (vscode) {
                                                                uploadTestResults(testResultsDirectory)
                                                                    .then(function (code) {
                                                                        if (!isNaN(+code) && +code !== 0) {
                                                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + code, 1013, false);
                                                                            defer.resolve(+code);
                                                                        } else if (vscode !== 0) {
                                                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + String(vscode), 1014, true);
                                                                            defer.resolve(vscode);
                                                                        }

                                                                        defer.resolve(tl.TaskResult.Succeeded);
                                                                    })
                                                                    .fail(function (code) {
                                                                        tl.debug('Test Run Updation failed!');
                                                                        utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + code, 1015, false);
                                                                        defer.resolve(tl.TaskResult.Failed);
                                                                    })
                                                                    .finally(function () {
                                                                        cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                                        tl.rmRF(tiaConfig.runIdFile);
                                                                    });
                                                            })
                                                            .fail(function (code) {
                                                                if (code !== 0) {
                                                                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1016, false);
                                                                }
                                                                defer.resolve(code);
                                                            })
                                                            .finally(function () {
                                                                cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                            });
                                                    })
                                                    .fail(function (err) {
                                                        utils.Helper.publishEventToCi(AreaCodes.UPDATERESPONSEFILE, err.message, 1017, false);
                                                        tl.error(err);
                                                        tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', responseFile));
                                                        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false), true)
                                                            .then(function (vscode) {
                                                                uploadTestResults(testResultsDirectory)
                                                                    .then(function (code) {
                                                                        if (!isNaN(+code) && +code !== 0) {
                                                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.UPLOADTESTRESULTSRETURNED + code, 1018, false);
                                                                            defer.resolve(+code);
                                                                        } else if (vscode !== 0) {
                                                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + String(vscode), 1019, false);
                                                                            defer.resolve(vscode);
                                                                        }

                                                                        defer.resolve(tl.TaskResult.Succeeded);
                                                                    })
                                                                    .fail(function (code) {
                                                                        tl.debug('Test Run Updation failed!');
                                                                        utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.TESTRUNUPDATIONFAILED, 1020, false);
                                                                        defer.resolve(tl.TaskResult.Failed);
                                                                    })
                                                                    .finally(function () {
                                                                        cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                                        tl.rmRF(tiaConfig.runIdFile);
                                                                    });
                                                            })
                                                            .fail(function (code) {
                                                                if (code !== 0) {
                                                                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1021, false);
                                                                }
                                                                defer.resolve(code);
                                                            }).finally(function () {
                                                                cleanFiles(responseFile, listFile, testCaseFilterFile, testCaseFilterOutput);
                                                            });
                                                    })
                                                    .fail(function (err) {
                                                        utils.Helper.publishEventToCi(AreaCodes.UPDATERESPONSEFILE, err.message, 1022, false);
                                                        tl.error(err);
                                                        defer.resolve(tl.TaskResult.Failed);
                                                    });
                                            }
                                        })
                                        .fail(function (err) {
                                            utils.Helper.publishEventToCi(AreaCodes.RESPONSECONTAINSNOTESTS, err.message, 1023, false);
                                            tl.error(err);
                                            defer.resolve(tl.TaskResult.Failed);
                                        });
                                }
                            })
                            .fail(function (err) {
                                utils.Helper.publishEventToCi(AreaCodes.GENERATERESPONSEFILE, err.message, 1024, false);
                                tl.error(err);
                                tl.warning(tl.loc('ErrorWhileCreatingResponseFile'));
                                executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false), true)
                                    .then(function (vscode) {
                                        uploadTestResults(testResultsDirectory)
                                            .then(function (code) {
                                                if (!isNaN(+code) && +code !== 0) {
                                                    defer.resolve(+code);
                                                } else if (vscode !== 0) {
                                                    defer.resolve(vscode);
                                                }

                                                defer.resolve(tl.TaskResult.Succeeded);
                                            })
                                            .fail(function (code) {
                                                tl.debug('Test Run Updation failed!');
                                                defer.resolve(tl.TaskResult.Failed);
                                            })
                                            .finally(function () {
                                                tl.debug('Deleting the discovered tests file' + listFile);
                                                tl.rmRF(listFile);
                                            });
                                    })
                                    .fail(function (code) {
                                        if (code !== 0) {
                                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1025, false);
                                        }
                                        defer.resolve(code);
                                    });
                            })
                            .fail(function (err) {
                                utils.Helper.publishEventToCi(AreaCodes.GENERATERESPONSEFILE, err.message, 1026, false);
                                tl.error(err);
                                defer.resolve(tl.TaskResult.Failed);
                            });
                    })
                    .fail(function (err) {
                        utils.Helper.publishEventToCi(AreaCodes.GETVSTESTTESTSLIST, err.message, 1027, false);
                        tl.error(err);
                        tl.warning(tl.loc('ErrorWhileListingDiscoveredTests'));
                        defer.resolve(tl.TaskResult.Failed);
                    });
            } else {
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
                executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false), true)
                    .then(function (code) {
                        publishTestResults(testResultsDirectory);
                        if (code !== 0) {
                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1028, false);
                        }
                        defer.resolve(code);
                    })
                    .fail(function (code) {
                        if (code !== 0) {
                            utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1029, false);
                        }
                        defer.resolve(code);
                    });
            }
    } else {
        tl.debug('Non TIA mode of test execution');
        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false), true)
            .then(function (code) {
                if (code !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1030, false);
                }
                defer.resolve(code);
            })
            .fail(function (code) {
                if (code !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.UPLOADTESTRESULTS, ResultMessages.EXECUTEVSTESTRETURNED + code, 1031, false);
                }
                defer.resolve(code);
            });
    }
    return defer.promise;
}

function invokeVSTest(testResultsDirectory: string): Q.Promise<number> {
    const defer = Q.defer<number>();

    try {
        const disableTIA = tl.getVariable('DisableTestImpactAnalysis');
        if (disableTIA !== undefined && disableTIA.toLowerCase() === 'true') {
            tiaConfig.tiaEnabled = false;
        }

        if (tiaConfig.tiaEnabled && (vstestConfig.vsTestVersionDetails === null || !vstestConfig.vsTestVersionDetails.isTestImpactSupported())) {
            tl.warning(tl.loc('VstestTIANotSupported'));
            tiaConfig.tiaEnabled = false;
        }
    } catch (e) {
        utils.Helper.publishEventToCi(AreaCodes.TIACONFIG, e.message, 1032, false);
        tl.error(e.message);
        defer.resolve(tl.TaskResult.Failed);
        return defer.promise;
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
        settingsHelper.updateSettingsFileAsRequired(vstestConfig.settingsFile, vstestConfig.runInParallel, vstestConfig.tiaConfig, vstestConfig.vsTestVersionDetails, false, vstestConfig.overrideTestrunParameters, false).
            then(function (ret) {
                newSettingsFile = ret;
                runVStest(testResultsDirectory, newSettingsFile, vsVersion)
                    .then(function (code) {
                        if (code !== 0) {
                            utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, 'RunVStest returned ' + code, 1034, true);
                        }
                        defer.resolve(code);
                    })
                    .fail(function (code) {
                        if (code !== 0) {
                            utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, 'RunVStest returned ' + code, 1035, false);
                        }
                        defer.resolve(code);
                    });
            });
    } catch (error) {
        tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
        tl.debug(error);
        //Should continue to run without the selected configurations.
        runVStest(testResultsDirectory, newSettingsFile, vsVersion)
            .then(function (code) {
                if (code !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, 'RunVStest returned ' + code, 1036, false);
                }
                defer.resolve(code);
            })
            .fail(function (code) {
                if (code !== 0) {
                    utils.Helper.publishEventToCi(AreaCodes.INVOKEVSTEST, 'RunVStest returned ' + code, 1037, false);
                }
                defer.resolve(code);
            });
    }

    return defer.promise;
}

function publishTestResults(testResultsDirectory: string) {
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
}

function cleanUp(temporarySettingsFile: string) {
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

function responseContainsNoTests(filePath: string): Q.Promise<boolean> {
    return utils.Helper.readFileContents(filePath, 'utf-8').then(function (resp) {
        if (resp === '/Tests:"' || resp === '/Tests:' || resp === '/TestCaseFilter:') {
            return true;
        } else {
            return false;
        }
    });
}
