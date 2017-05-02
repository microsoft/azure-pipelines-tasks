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

let os = require('os');
let regedit = require('regedit');
let uuid = require('node-uuid');
let fs = require('fs');
let xml2js = require('xml2js');
let perf = require('performance-now');
let process = require('process');

const runSettingsExt = '.runsettings';
const testSettingsExt = '.testsettings';

let vstestConfig: models.VsTestConfigurations = undefined;
let tiaConfig: models.TiaConfiguration = undefined;
const systemDefaultWorkingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
const workingDirectory = systemDefaultWorkingDirectory;
let testAssemblyFiles = undefined;
let resultsDirectory = null;

export function startTest() {
    try {
        tl._writeLine(tl.loc('runTestsLocally', 'vstest.console.exe'));
        tl._writeLine('========================================================');
        vstestConfig = taskInputParser.getvsTestConfigurations();
        tl._writeLine('========================================================');

        tiaConfig = vstestConfig.tiaConfig;

        //Try to find the results directory for clean up. This may change later if runsettings has results directory and location go runsettings file changes.
        resultsDirectory = getTestResultsDirectory(vstestConfig.settingsFile, path.join(workingDirectory, 'TestResults'));
        tl.debug('TestRunResults Directory : ' + resultsDirectory);

        // clean up old testResults
        tl.rmRF(resultsDirectory, true);
        tl.mkdirP(resultsDirectory);

        testAssemblyFiles = getTestAssemblies();

        if (!testAssemblyFiles || testAssemblyFiles.length === 0) {
            deleteVstestDiagFile();
            tl._writeLine('##vso[task.logissue type=warning;code=002004;]');
            tl.warning(tl.loc('NoMatchingTestAssemblies', vstestConfig.sourceFilter));
            return;
        }

        invokeVSTest(resultsDirectory)
            .then(function (code) {
                try {
                    if (!isTiaAllowed()) {
                        publishTestResults(resultsDirectory);
                    }
                    tl.setResult(code, tl.loc('VstestReturnCode', code));
                    deleteVstestDiagFile();
                } catch (error) {
                    deleteVstestDiagFile();
                    tl._writeLine('##vso[task.logissue type=error;code=' + error + ';TaskName=VSTest]');
                    throw error;
                }
            })
            .fail(function (err) {
                deleteVstestDiagFile();
                tl._writeLine('##vso[task.logissue type=error;code=' + err + ';TaskName=VSTest]');
                throw err;
            });
    } catch (error) {
        deleteVstestDiagFile();
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

function getTestAssemblies(): string[] {
    if (isNullOrWhitespace(vstestConfig.testDropLocation)) {
        vstestConfig.testDropLocation = systemDefaultWorkingDirectory;
        tl.debug('Search directory empty, defaulting to ' + vstestConfig.testDropLocation);
    }

    tl.debug('Searching for test assemblies in: ' + vstestConfig.testDropLocation);
    return tl.findMatch(vstestConfig.testDropLocation, vstestConfig.sourceFilter);
}

function getVstestArguments(settingsFile: string, tiaEnabled: boolean): string[] {
    const argsArray: string[] = [];
    testAssemblyFiles.forEach(function (testAssembly) {
        let testAssemblyPath = testAssembly;
        //To maintain parity with the behaviour when test assembly was filepath, try to expand it relative to build sources directory.
        if (systemDefaultWorkingDirectory && !pathExistsAsFile(testAssembly)) {
            const expandedPath = path.join(systemDefaultWorkingDirectory, testAssembly);
            if (pathExistsAsFile(expandedPath)) {
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
        if (pathExistsAsFile(settingsFile)) {
            argsArray.push('/Settings:' + settingsFile);
            utils.Helper.readFileContents(settingsFile, 'utf-8').then(function (settings) {
                tl.debug('Running VsTest with settings : ' + settings);
            });
        } else {
            if (!tl.exist(settingsFile)) { // because this is filepath input build puts default path in the input. To avoid that we are checking this.
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
    if (isNullOrWhitespace(vstestConfig.pathtoCustomTestAdapters)) {
        if (systemDefaultWorkingDirectory && isTestAdapterPresent(vstestConfig.testDropLocation)) {
                argsArray.push('/TestAdapterPath:\"' + systemDefaultWorkingDirectory + '\"');
            }
    } else {
        argsArray.push('/TestAdapterPath:\"' + vstestConfig.pathtoCustomTestAdapters + '\"');
    }

    if (isDebugEnabled()) {
        if (vstestConfig.vsTestVersionDetais != null && vstestConfig.vsTestVersionDetais.vstestDiagSupported()) {
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
        if (!arr.startsWith('/')) {
            argsArray[i] = '\"' + arr + '\"';
        }
    });
    fs.appendFile(responseFile, os.EOL + argsArray.join(os.EOL), function (err) {
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
    if (!isNullOrWhitespace(testResultsDirectory)) {
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
            'context': tiaConfig.context
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
            tl._writeLine('##vso[task.logissue type=warning;SubTaskName=UploadTestResults;SubTaskDuration=' + elapsedTime + ']');
            tl.debug(tl.loc('UploadTestResultsPerfTime', elapsedTime));
            defer.resolve(String(code));
        })
        .fail(function (err) {
            defer.reject(err);
        });
    return defer.promise;
}

function generateResponseFile(discoveredTests: string): Q.Promise<string> {
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
            'useTestCaseFilterInResponseFile': useTestCaseFilterInResponseFile
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

function publishCodeChanges(): Q.Promise<string> {
    const startTime = perf();
    let endTime: number;
    let elapsedTime: number;
    let pathFilters: string;
    let definitionRunId: string;
    let definitionId: string;
    let prFlow: string;
    let rebaseLimit: string;
    let sourcesDirectory: string;
    const defer = Q.defer<string>();

    let newprovider = 'true';
    if (getTIALevel() === 'method') {
        newprovider = 'false';
    }

    const selectortool = tl.tool(getTestSelectorLocation());
    selectortool.arg('PublishCodeChanges');

    if (tiaConfig.context === 'CD') {
        // Release context. Passing Release Id.
        definitionRunId = tl.getVariable('Release.ReleaseId');
        definitionId = tl.getVariable('release.DefinitionId');
    } else {
        // Build context. Passing build id.
        definitionRunId = tl.getVariable('Build.BuildId');
        definitionId = tl.getVariable('System.DefinitionId');
    }

    if (tiaConfig.isPrFlow && tiaConfig.isPrFlow.toUpperCase() === 'TRUE') {
        prFlow = 'true';
    } else {
        prFlow = 'false';
    }

    if (tiaConfig.tiaRebaseLimit) {
        rebaseLimit = tiaConfig.tiaRebaseLimit;
    }

    if (typeof tiaConfig.tiaFilterPaths !== 'undefined') {
        pathFilters = tiaConfig.tiaFilterPaths.trim();
    } else {
        pathFilters = '';
    }

    if (typeof tiaConfig.sourcesDir !== 'undefined') {
        sourcesDirectory = tiaConfig.sourcesDir.trim();
    } else {
        sourcesDirectory = '';
    }

    selectortool.exec({
        cwd: null,
        env: {
            'collectionurl': tl.getVariable('System.TeamFoundationCollectionUri'),
            'projectid': tl.getVariable('System.TeamProject'),
            'definitionrunid': definitionRunId,
            'definitionid': definitionId,
            'token': tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            'sourcesdir': sourcesDirectory,
            'newprovider': newprovider,
            'prflow': prFlow,
            'rebaselimit': rebaseLimit,
            'baselinefile': tiaConfig.baseLineBuildIdFile,
            'context': tiaConfig.context,
            'filter': pathFilters
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
            tl.debug(tl.loc('PublishCodeChangesPerfTime', elapsedTime));
            defer.resolve(String(code));
        })
        .fail(function (err) {
            defer.reject(err);
        });

    return defer.promise;
}

function executeVstest(testResultsDirectory: string, parallelRunSettingsFile: string, vsVersion: number, argsArray: string[]): Q.Promise<number> {
    const defer = Q.defer<number>();
    const vstest = tl.tool(vstestConfig.vsTestVersionDetais.vstestExeLocation);
    addVstestArgs(argsArray, vstest);

    // Adding the other console options here
    //   => Because it should be added as ".line" inorder to pass multiple parameters
    //   => Parsing will be taken care by .line
    // https://github.com/Microsoft/vsts-task-lib/blob/master/node/docs/vsts-task-lib.md#toolrunnerToolRunnerline
    if (!utils.Helper.isNullEmptyOrUndefined(vstestConfig.otherConsoleOptions)) {
        vstest.line(vstestConfig.otherConsoleOptions);
    }

    //Re-calculate the results directory based on final runsettings and clean up again if required.
    resultsDirectory = getTestResultsDirectory(parallelRunSettingsFile, path.join(workingDirectory, 'TestResults'));
    tl.rmRF(resultsDirectory, true);
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
                defer.resolve(0); // ignore failures.
            } else {
                defer.resolve(code);
            }
        })
        .fail(function (err) {
            cleanUp(parallelRunSettingsFile);
            tl.warning(tl.loc('VstestFailed'));
            if (ignoreTestFailures) {
                tl.warning(err);
                defer.resolve(0);
            } else {
                tl.error(err);
                defer.resolve(1);
            }
        });
    return defer.promise;
}

function getVstestTestsList(vsVersion: number): Q.Promise<string> {
    const defer = Q.defer<string>();
    const tempFile = path.join(os.tmpdir(), uuid.v1() + '.txt');
    tl.debug('Discovered tests listed at: ' + tempFile);
    const argsArray: string[] = [];

    testAssemblyFiles.forEach(function (testAssembly) {
        let testAssemblyPath = testAssembly;
        if (systemDefaultWorkingDirectory && !pathExistsAsFile(testAssembly)) {
            const expandedPath = path.join(systemDefaultWorkingDirectory, testAssembly);
            if (pathExistsAsFile(expandedPath)) {
                testAssemblyPath = expandedPath;
            }
        }
        argsArray.push(testAssemblyPath);
    });

    tl.debug('The list of discovered tests is generated at ' + tempFile);

    argsArray.push('/ListFullyQualifiedTests');
    argsArray.push('/ListTestsTargetPath:' + tempFile);
    if (vstestConfig.testcaseFilter) {
        argsArray.push('/TestCaseFilter:' + vstestConfig.testcaseFilter);
    }
    if (vstestConfig.pathtoCustomTestAdapters) {
        if (pathExistsAsDirectory(vstestConfig.pathtoCustomTestAdapters)) {
            argsArray.push('/TestAdapterPath:\"' + vstestConfig.pathtoCustomTestAdapters + '\"');
        } else {
            argsArray.push('/TestAdapterPath:\"' + path.dirname(vstestConfig.pathtoCustomTestAdapters) + '\"');
        }
    } else if (systemDefaultWorkingDirectory && isTestAdapterPresent(vstestConfig.testDropLocation)) {
        argsArray.push('/TestAdapterPath:\"' + systemDefaultWorkingDirectory + '\"');
    }

    if (vstestConfig.pathtoCustomTestAdapters && vstestConfig.pathtoCustomTestAdapters.toLowerCase().indexOf('usevsixextensions:true') !== -1) {
        argsArray.push('/UseVsixExtensions:true');
    }

    let vstest = tl.tool(vstestConfig.vsTestVersionDetais.vstestExeLocation);

    if (vsVersion === 14.0) {
        tl.debug('Visual studio 2015 selected. Selecting vstest.console.exe in task ');
        const vsTestPath = path.join(__dirname, 'TestSelector/14.0/vstest.console.exe') // Use private vstest as the changes to discover tests are not there in update3
        vstest = tl.tool(vsTestPath);
    }
    addVstestArgs(argsArray, vstest);

    tl.cd(workingDirectory);
    vstest.exec(<tr.IExecOptions>{ failOnStdErr: true })
        .then(function (code) {
            defer.resolve(tempFile);
        })
        .fail(function (err) {
            tl.debug('Listing tests from VsTest failed.');
            tl.error(err);
            defer.resolve(err);
        });
    return defer.promise;
}

function cleanFiles(responseFile: string, listFile: string): void {
    tl.debug('Deleting the response file ' + responseFile);
    tl.rmRF(responseFile, true);
    tl.debug('Deleting the discovered tests file ' + listFile);
    tl.rmRF(listFile, true);
    tl.debug('Deleting the baseline build id file ' + tiaConfig.baseLineBuildIdFile);
    tl.rmRF(tiaConfig.baseLineBuildIdFile, true);
}

function deleteVstestDiagFile(): void {
    if (vstestConfig && vstestConfig.vstestDiagFile && pathExistsAsFile(vstestConfig.vstestDiagFile)) {
        tl.debug('Deleting vstest diag file ' + vstestConfig.vstestDiagFile);
        tl.rmRF(vstestConfig.vstestDiagFile, true);
    }
}

function runVStest(testResultsDirectory: string, settingsFile: string, vsVersion: number): Q.Promise<number> {
    const defer = Q.defer<number>();
    if (isTiaAllowed()) {
        publishCodeChanges()
            .then(function (status) {
                getVstestTestsList(vsVersion)
                    .then(function (listFile) {
                        generateResponseFile(listFile)
                            .then(function (responseFile) {
                                if (isEmptyResponseFile(responseFile)) {
                                    tl.debug('Empty response file detected. All tests will be executed.');
                                    executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false))
                                        .then(function (vscode) {
                                            uploadTestResults(testResultsDirectory)
                                                .then(function (code) {
                                                    if (!isNaN(+code) && +code !== 0) {
                                                        defer.resolve(+code);
                                                    } else if (vscode !== 0) {
                                                        defer.resolve(vscode);
                                                    }

                                                    defer.resolve(0);
                                                })
                                                .fail(function (code) {
                                                    tl.debug('Test Run Updation failed!');
                                                    defer.resolve(1);
                                                })
                                                .finally(function () {
                                                    cleanFiles(responseFile, listFile);
                                                    tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                    tl.rmRF(tiaConfig.runIdFile, true);
                                                });
                                        })
                                        .fail(function (code) {
                                            defer.resolve(code);
                                        })
                                        .finally(function () {
                                            cleanFiles(responseFile, listFile);
                                        });
                                } else {
                                    responseContainsNoTests(responseFile)
                                        .then(function (noTestsAvailable) {
                                            if (noTestsAvailable) {
                                                tl.debug('No tests impacted. Not running any tests.');
                                                uploadTestResults('')
                                                    .then(function (code) {
                                                        if (!isNaN(+code) && +code !== 0) {
                                                            defer.resolve(+code);
                                                        }
                                                        defer.resolve(0);
                                                    })
                                                    .fail(function (code) {
                                                        tl.debug('Test Run Updation failed!');
                                                        defer.resolve(1);
                                                    })
                                                    .finally(function () {
                                                        cleanFiles(responseFile, listFile);
                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                        tl.rmRF(tiaConfig.runIdFile, true);
                                                    });
                                            } else {
                                                updateResponseFile(getVstestArguments(settingsFile, true), responseFile)
                                                    .then(function (updatedFile) {
                                                        executeVstest(testResultsDirectory, settingsFile, vsVersion, ['@' + updatedFile])
                                                            .then(function (vscode) {
                                                                uploadTestResults(testResultsDirectory)
                                                                    .then(function (code) {
                                                                        if (!isNaN(+code) && +code !== 0) {
                                                                            defer.resolve(+code);
                                                                        } else if (vscode !== 0) {
                                                                            defer.resolve(vscode);
                                                                        }

                                                                        defer.resolve(0);
                                                                    })
                                                                    .fail(function (code) {
                                                                        tl.debug('Test Run Updation failed!');
                                                                        defer.resolve(1);
                                                                    })
                                                                    .finally(function () {
                                                                        cleanFiles(responseFile, listFile);
                                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                                        tl.rmRF(tiaConfig.runIdFile, true);
                                                                    });
                                                            })
                                                            .fail(function (code) {
                                                                defer.resolve(code);
                                                            })
                                                            .finally(function () {
                                                                cleanFiles(responseFile, listFile);
                                                            });
                                                    })
                                                    .fail(function (err) {
                                                        tl.error(err);
                                                        tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', responseFile));
                                                        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false))
                                                            .then(function (vscode) {
                                                                uploadTestResults(testResultsDirectory)
                                                                    .then(function (code) {
                                                                        if (!isNaN(+code) && +code !== 0) {
                                                                            defer.resolve(+code);
                                                                        } else if (vscode !== 0) {
                                                                            defer.resolve(vscode);
                                                                        }

                                                                        defer.resolve(0);
                                                                    })
                                                                    .fail(function (code) {
                                                                        tl.debug('Test Run Updation failed!');
                                                                        defer.resolve(1);
                                                                    })
                                                                    .finally(function () {
                                                                        cleanFiles(responseFile, listFile);
                                                                        tl.debug('Deleting the run id file' + tiaConfig.runIdFile);
                                                                        tl.rmRF(tiaConfig.runIdFile, true);
                                                                    });
                                                            })
                                                            .fail(function (code) {
                                                                defer.resolve(code);
                                                            }).finally(function () {
                                                                cleanFiles(responseFile, listFile);
                                                            });
                                                    })
                                                    .fail(function (err) {
                                                        tl.error(err)
                                                        defer.resolve(1);
                                                    });
                                            }
                                        })
                                        .fail(function (err) {
                                            tl.error(err)
                                            defer.resolve(1);
                                        });
                                }
                            })
                            .fail(function (err) {
                                tl.error(err);
                                tl.warning(tl.loc('ErrorWhileCreatingResponseFile'));
                                executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false))
                                    .then(function (vscode) {
                                        uploadTestResults(testResultsDirectory)
                                            .then(function (code) {
                                                if (!isNaN(+code) && +code !== 0) {
                                                    defer.resolve(+code);
                                                } else if (vscode !== 0) {
                                                    defer.resolve(vscode);
                                                }

                                                defer.resolve(0);
                                            })
                                            .fail(function (code) {
                                                tl.debug('Test Run Updation failed!');
                                                defer.resolve(1);
                                            })
                                            .finally(function () {
                                                tl.debug('Deleting the discovered tests file' + listFile);
                                                tl.rmRF(listFile, true);
                                            });
                                    })
                                    .fail(function (code) {
                                        defer.resolve(code);
                                    });
                            })
                            .fail(function (err) {
                                tl.error(err)
                                defer.resolve(1);
                            });
                    })
                    .fail(function (err) {
                        tl.error(err);
                        tl.warning(tl.loc('ErrorWhileListingDiscoveredTests'));
                        defer.resolve(1);
                    });
            })
            .fail(function (err) {
                tl.error(err);
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
                executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false))
                    .then(function (code) {
                        publishTestResults(testResultsDirectory);
                        defer.resolve(code);
                    })
                    .fail(function (code) {
                        defer.resolve(code);
                    });
            });
    } else {
        tl.debug('Non TIA mode of test execution');
        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile, false))
            .then(function (code) {
                defer.resolve(code);
            })
            .fail(function (code) {
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

        if (tiaConfig.tiaEnabled && (vstestConfig.vsTestVersionDetais === null || !vstestConfig.vsTestVersionDetais.isTestImpactSupported())) {
            tl.warning(tl.loc('VstestTIANotSupported'));
            tiaConfig.tiaEnabled = false;
        }
    } catch (e) {
        tl.error(e.message);
        defer.resolve(1);
        return defer.promise;
    }

    // We need to use private data collector dll
    if (vstestConfig.vsTestVersionDetais !== null) {
        tiaConfig.useNewCollector = vstestConfig.vsTestVersionDetais.isPrivateDataCollectorNeededForTIA();
    }

    setRunInParallellIfApplicable();

    let newSettingsFile = vstestConfig.settingsFile;
    const vsVersion = vstestConfig.vsTestVersionDetais.majorVersion;

    if (newSettingsFile) {
        if (!pathExistsAsFile(newSettingsFile)) {
            if (!tl.exist(newSettingsFile)) { // because this is filepath input build puts default path in the input. To avoid that we are checking this.
                throw Error((tl.loc('InvalidSettingsFile', newSettingsFile)));
            }
        }
    }

    try {
        settingsHelper.updateSettingsFileAsRequired(vstestConfig.settingsFile, vstestConfig.runInParallel, vstestConfig.tiaConfig, vsVersion, false, vstestConfig.overrideTestrunParameters).
            then(function (ret) {
                newSettingsFile = ret;
                runVStest(testResultsDirectory, newSettingsFile, vsVersion)
                    .then(function (code) {
                        defer.resolve(code);
                    })
                    .fail(function (code) {
                        defer.resolve(code);
                    });
            })
    } catch (error) {
        tl.warning(tl.loc('ErrorWhileUpdatingSettings'));
        tl.debug(error);
        //Should continue to run without the selected configurations.
        runVStest(testResultsDirectory, newSettingsFile, vsVersion)
            .then(function (code) {
                defer.resolve(code);
            })
            .fail(function (code) {
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
            tl._writeLine('##vso[task.logissue type=warning;code=002003;]');
            tl.warning(tl.loc('NoResultsToPublish'));
        }
    }
}

function cleanUp(temporarySettingsFile: string) {
    //cleanup the runsettings file
    if (temporarySettingsFile && vstestConfig.settingsFile !== temporarySettingsFile) {
        try {
            tl.rmRF(temporarySettingsFile, true);
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

    if (!settingsFile || !pathExistsAsFile(settingsFile)) {
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
        if (vstestConfig.vsTestVersionDetais != null && vstestConfig.vsTestVersionDetais.isRunInParallelSupported()) {
            return;
        }

        // 2015 Update3 needed for run in parallel.
        tl.warning(tl.loc('UpdateThreeOrHigherRequired'));
        vstestConfig.runInParallel = false;
    }
}

function pathExistsAsFile(path: string) {
    return tl.exist(path) && tl.stats(path).isFile();
}

function pathExistsAsDirectory(path: string) {
    return tl.exist(path) && tl.stats(path).isDirectory();
}

function isEmptyResponseFile(responseFile: string): boolean {
    if (pathExistsAsFile(responseFile) && tl.stats(responseFile).size) {
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

function getTIALevel() {
    if (tiaConfig.fileLevel && tiaConfig.fileLevel.toUpperCase() === 'FALSE') {
        return 'method';
    }
    return 'file';
}

function responseContainsNoTests(filePath: string): Q.Promise<boolean> {
    return utils.Helper.readFileContents(filePath, 'utf-8').then(function (resp) {
        if (resp === '/Tests:' || resp === '/TestCaseFilter:') {
            return true;
        }
        else {
            return false;
        }
    });
}

function isNullOrWhitespace(input) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}