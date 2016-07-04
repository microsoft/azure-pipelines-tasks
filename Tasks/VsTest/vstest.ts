/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');
var os = require('os');
var regedit = require('regedit');
var uuid = require('node-uuid');
var fs = require('fs');
var xml2js = require('xml2js');

const runSettingsExt = ".runsettings";
const testSettingsExt = ".testsettings";
const TIFriendlyName = "Test Impact";
const TICollectorURI = "datacollector://microsoft/TestImpact/1.0";
const TITestSettingsAgentNameTag = "testImpact-5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TITestSettingsNameTag = "testSettings-5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TITestSettingsIDTag = "5d76a195-1e43-4b90-a6ce-4ec3de87ed25";
const TITestSettingsXmlnsTag = "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    var vsTestVersion: string = tl.getInput('vsTestVersion');
    var testAssembly: string = tl.getInput('testAssembly', true);
    var testFiltercriteria: string = tl.getInput('testFiltercriteria');
    var runSettingsFile: string = tl.getPathInput('runSettingsFile');
    var codeCoverageEnabled: boolean = tl.getBoolInput('codeCoverageEnabled');
    var pathtoCustomTestAdapters: string = tl.getInput('pathtoCustomTestAdapters');
    var overrideTestrunParameters: string = tl.getInput('overrideTestrunParameters');
    var otherConsoleOptions: string = tl.getInput('otherConsoleOptions');
    var testRunTitle: string = tl.getInput('testRunTitle');
    var platform: string = tl.getInput('platform');
    var configuration: string = tl.getInput('configuration');
    var publishRunAttachments: string = tl.getInput('publishRunAttachments');
    var runInParallel: boolean = tl.getBoolInput('runInParallel');
    var tiaEnabled = tl.getVariable('tia.enabled');
    var tiaSelectorTool = tl.getVariable('tia.selectortool');

    tl._writeLine("##vso[task.logissue type=warning;TaskName=VSTest]");

    var sourcesDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    var testAssemblyFiles = getTestAssemblies();

    if (testAssemblyFiles && testAssemblyFiles.size != 0) {
        var workingDirectory = path.join(sourcesDirectory, "..");
        getTestResultsDirectory(runSettingsFile, path.join(workingDirectory, 'TestResults')).then(function (resultsDirectory) {
            invokeVSTest(resultsDirectory)
                .then(function (code) {
                    try {
                        publishTestResults(resultsDirectory);
                        tl.setResult(code, tl.loc('VstestReturnCode', code));
                    }
                    catch (error) {
                        tl._writeLine("##vso[task.logissue type=error;code=" + error + ";TaskName=VSTest]");
                        throw error;
                    }
                })
                .fail(function (err) {
                    tl._writeLine("##vso[task.logissue type=error;code=" + err + ";TaskName=VSTest]");
                    throw err;
                });
        });
    }
    else {
        tl._writeLine("##vso[task.logissue type=warning;code=002004;]");
        tl.warning(tl.loc('NoMatchingTestAssemblies', testAssembly));
    }
}
catch (error) {
    tl._writeLine("##vso[task.logissue type=error;code=" + error + ";TaskName=VSTest]");
    throw error;
}

function getTestAssemblies(): Set<string> {
    var testAssemblyFiles = [];
    if (testAssembly.indexOf('*') >= 0 || testAssembly.indexOf('?') >= 0) {
        tl.debug('Pattern found in solution parameter.');
        var excludeTestAssemblies = [];
        var allFiles = tl.find(sourcesDirectory);
        var testAssemblyFilters = testAssembly.split(';');
        testAssemblyFilters.forEach(function (testAssemblyFilter) {
            if (testAssemblyFilter.startsWith("-:")) {
                if (testAssemblyFilter.indexOf('*') >= 0 || testAssemblyFilter.indexOf('?') >= 0) {
                    excludeTestAssemblies = excludeTestAssemblies.concat(getFilteredFiles(testAssemblyFilter.substr(2), allFiles));
                }
                else {
                    excludeTestAssemblies.push(testAssemblyFilter.substr(2));
                }
            }
            else if (testAssemblyFilter.indexOf('*') >= 0 || testAssemblyFilter.indexOf('?') >= 0) {
                testAssemblyFiles = testAssemblyFiles.concat(getFilteredFiles(testAssemblyFilter, allFiles));
            }
            else {
                testAssemblyFiles.push(testAssemblyFilter);
            }
        });
        testAssemblyFiles = testAssemblyFiles.filter(x => excludeTestAssemblies.indexOf(x) < 0);
    }
    else {
        tl.debug('No Pattern found in solution parameter.');
        var assemblies = testAssembly.split(';');
        assemblies.forEach(function (assembly) {
            testAssemblyFiles.push(assembly);
        });
    }
    return new Set(testAssemblyFiles);
}

function getVstestArguments(settingsFile: string): string[] {
    var argsArray: string[] = [];
    testAssemblyFiles.forEach(function (testAssembly) {
        var testAssemblyPath = testAssembly;
        //To maintain parity with the behaviour when test assembly was filepath, try to expand it relative to build sources directory.
        if (sourcesDirectory && !pathExistsAsFile(testAssembly)) {
            var expandedPath = path.join(sourcesDirectory, testAssembly);
            if (pathExistsAsFile(expandedPath)) {
                testAssemblyPath = expandedPath;
            }
        }
        argsArray.push(testAssemblyPath);
    });
    if (testFiltercriteria) {
        argsArray.push("/TestCaseFilter:" + testFiltercriteria);
    }
    if (settingsFile && pathExistsAsFile(settingsFile)) {
        argsArray.push("/Settings:" + settingsFile);
    }
    if (codeCoverageEnabled) {
        argsArray.push("/EnableCodeCoverage");
    }
    if (otherConsoleOptions) {
        argsArray.push(otherConsoleOptions);
    }
    argsArray.push("/logger:trx");
    if (pathtoCustomTestAdapters) {
        if (pathExistsAsDirectory(pathtoCustomTestAdapters)) {
            argsArray.push("/TestAdapterPath:\"" + pathtoCustomTestAdapters + "\"");
        }
        else {
            argsArray.push("/TestAdapterPath:\"" + path.dirname(pathtoCustomTestAdapters) + "\"");
        }
    }
    else if (sourcesDirectory && isNugetRestoredAdapterPresent(sourcesDirectory)) {
        argsArray.push("/TestAdapterPath:\"" + sourcesDirectory + "\"");
    }
    return argsArray;
}

function addVstestArgs(argsArray: string[], vstest: any) {
    argsArray.forEach(function (arr) {
        vstest.arg(arr);
    });
}

function updateResponseFile(argsArray: string[], responseFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    fs.appendFile(responseFile, os.EOL + argsArray.join(os.EOL), function (err) {
        if (err) {
            defer.reject(err);
        }
        defer.resolve(responseFile);
    });
    return defer.promise;
}


function generateResponseFile(): Q.Promise<string> {
    var defer = Q.defer<string>();
    var tempFile = path.join(os.tmpdir(), uuid.v1() + ".txt");
    tl.debug("Response file will be generated at " + tempFile);
    var selectortool = tl.createToolRunner(tiaSelectorTool);
    selectortool.arg("GetImpactedtests");
    selectortool.arg("/TfsTeamProjectCollection:" + tl.getVariable("System.TeamFoundationCollectionUri"));
    selectortool.arg("/ProjectId:" + tl.getVariable("System.TeamProject"));
    selectortool.arg("/buildid:" + tl.getVariable("Build.BuildId"));
    selectortool.arg("/token:" + tl.getVariable("System.AccessToken"));
    selectortool.arg("/responsefile:" + tempFile);
    selectortool.exec()
        .then(function (code) {
            defer.resolve(tempFile);
        })
        .fail(function (err) {
            defer.reject(err);
        });

    return defer.promise;
}

function publishCodeChanges(): Q.Promise<string> {
    var defer = Q.defer<string>();
    var selectortool = tl.createToolRunner(tiaSelectorTool);
    selectortool.arg("PublishCodeChanges");
    selectortool.arg("/TfsTeamProjectCollection:" + tl.getVariable("System.TeamFoundationCollectionUri"));
    selectortool.arg("/ProjectId:" + tl.getVariable("System.TeamProject"));
    selectortool.arg("/newdropPath:" + tl.getVariable("Build.SourcesDirectory"));
    selectortool.arg("/Definitionid:" + tl.getVariable("System.DefinitionId"));
    selectortool.arg("/buildid:" + tl.getVariable("Build.BuildId"));
    selectortool.arg("/token:" + tl.getVariable("System.AccessToken"));

    selectortool.exec()
        .then(function(code) {
            defer.resolve(String(code));
        })        
        .fail(function (err) {            
            defer.reject(err);
        });

    return defer.promise;
}

function executeVstest(testResultsDirectory: string, parallelRunSettingsFile: string, vsVersion: number, argsArray: string[]): Q.Promise<number> {
    var defer = Q.defer<number>();
    var vsCommon = tl.getVariable("VS" + vsVersion + "0COMNTools");
    if (!vsCommon) {
        tl.error(tl.loc('VstestNotFound', vsVersion));
        defer.resolve(1);
        return defer.promise;
    }
    var vstestLocation = path.join(vsCommon, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe");
    var vstest = tl.createToolRunner(vstestLocation);
    addVstestArgs(argsArray, vstest);

    tl.rmRF(testResultsDirectory, true);
    tl.mkdirP(testResultsDirectory);
    tl.cd(workingDirectory);
    vstest.exec({failOnStdErr: true})
        .then(function (code) {
            cleanUp(parallelRunSettingsFile);
            defer.resolve(code);
        })
        .fail(function (err) {
            cleanUp(parallelRunSettingsFile);
            tl.warning(tl.loc('VstestFailed'));
            tl.error(err);
            defer.resolve(1);
        });
    return defer.promise;
}

function runVStest(testResultsDirectory: string, settingsFile: string, vsVersion: number): Q.Promise<number> {
    var defer = Q.defer<number>();
    if (isTiaAllowed()) {
        publishCodeChanges()
            .then(function(status) {
                generateResponseFile()
                    .then(function (responseFile) {
                        if (isNonEmptyResponseFile(responseFile)) {
                            updateResponseFile(getVstestArguments(settingsFile), responseFile)
                                .then(function (updatedFile) {
                                    executeVstest(testResultsDirectory, settingsFile, vsVersion, ["@" + updatedFile])
                                        .then(function (code) {
                                            defer.resolve(code);
                                        })
                                        .fail(function (code) {
                                            defer.resolve(code);
                                        })
                                        .finally(function () {
                                            tl.debug("Deleting the response file " + responseFile)
                                            tl.rmRF(responseFile, true);
                                        });
                                })
                                .fail(function (err) {
                                    tl.error(err);
                                    tl.warning(tl.loc('ErrorWhileUpdatingResponseFile', responseFile));
                                    executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile))
                                        .then(function (code) {
                                            defer.resolve(code);
                                        })
                                        .fail(function (code) {
                                            defer.resolve(code);
                                        }).finally(function () {
                                            tl.debug("Deleting the response file " + responseFile)
                                            tl.rmRF(responseFile, true);
                                        });
                                });
                        }
                        else {
                            tl.debug("Empty response file detected. All tests will be executed.");
                            executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile))
                                .then(function (code) {
                                    defer.resolve(code);
                                })
                                .fail(function (code) {
                                    defer.resolve(code);
                                })
                                .finally(function () {
                                    tl.debug("Deleting the response file " + responseFile)
                                    tl.rmRF(responseFile, true);
                                });
                        }
                    })
                    .fail(function (err) {
                        tl.error(err);
                        tl.warning(tl.loc('ErrorWhileCreatingResponseFile'));
                        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile))
                            .then(function (code) {
                                defer.resolve(code);
                            })
                            .fail(function (code) {
                                defer.resolve(code);
                            });
                    });
            })
            .fail(function (err){
                tl.error(err);
                tl.warning(tl.loc('ErrorWhilePublishingCodeChanges'));
                executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile))
                    .then(function (code) {
                        defer.resolve(code);
                    })
                    .fail(function (code) {
                        defer.resolve(code);
                    });
            });
    }
    else {
        tl.debug("Non TIA mode of test execution");
        executeVstest(testResultsDirectory, settingsFile, vsVersion, getVstestArguments(settingsFile))
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
    var defer = Q.defer<number>();
    if (vsTestVersion.toLowerCase() == "latest") {
        vsTestVersion = null;
    }
    overrideTestRunParametersIfRequired(runSettingsFile)
        .then(function (overriddenSettingsFile) {
            locateVSVersion()
                .then(function (vsVersion) {
                    setupSettingsFileForTestImpact(vsVersion, overriddenSettingsFile)
                        .then(function (runSettingswithTestImpact) {
                            setRunInParallellIfApplicable(vsVersion);
                            setupRunSettingsFileForParallel(runInParallel, runSettingswithTestImpact)
                                .then(function (parallelRunSettingsFile) {
                                    runVStest(testResultsDirectory, parallelRunSettingsFile, vsVersion)
                                        .then(function (code) {
                                            defer.resolve(code);
                                        })
                                        .fail(function (code) {
                                            defer.resolve(code);
                                        });
                                })
                                .fail(function (err) {
                                    tl.error(err);
                                    defer.resolve(1);
                                });
                        })
                        .fail(function (err) {
                            tl.error(err);
                            defer.resolve(1);
                        });
                })
                .fail(function (err) {
                    tl.error(err);
                    defer.resolve(1);
                });
        })
        .fail(function (err) {
            tl.error(err);
            defer.resolve(1);
        });

    return defer.promise;
}

function publishTestResults(testResultsDirectory: string) {
    if (testResultsDirectory) {
        var allFilesInResultsDirectory = tl.find(testResultsDirectory);
        var resultFiles = tl.match(allFilesInResultsDirectory, "*.trx", { matchBase: true });
        if (resultFiles && resultFiles.length != 0) {
            var tp = new tl.TestPublisher("VSTest");
            tp.publish(resultFiles, "false", platform, configuration, testRunTitle, publishRunAttachments);
        }
        else {
            tl._writeLine("##vso[task.logissue type=warning;code=002003;]");
            tl.warning(tl.loc('NoResultsToPublish'));
        }
    }
}

function getFilteredFiles(filesFilter: string, allFiles: string[]): string[] {
    if (os.type().match(/^Win/)) {
        return tl.match(allFiles, filesFilter, { matchBase: true, nocase: true });
    }
    else {
        return tl.match(allFiles, filesFilter, { matchBase: true });
    }
}

function cleanUp(temporarySettingsFile: string) {
    //cleanup the runsettings file
    if (temporarySettingsFile && runSettingsFile != temporarySettingsFile) {
        try {
            tl.rmRF(temporarySettingsFile, true);
        }
        catch (error) {
            //ignore. just cleanup.
        }
    }
}

function overrideTestRunParametersIfRequired(settingsFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    if (!settingsFile || !pathExistsAsFile(settingsFile) || !overrideTestrunParameters || overrideTestrunParameters.trim().length == 0) {
        defer.resolve(settingsFile);
        return defer.promise;
    }

    overrideTestrunParameters = overrideTestrunParameters.trim();
    var overrideParameters = {};

    var parameterStrings = overrideTestrunParameters.split(";");
    parameterStrings.forEach(function (parameterString) {
        var pair = parameterString.split("=", 2);
        if (pair.length == 2) {
            var key = pair[0];
            var value = pair[1];
            if (!overrideParameters[key]) {
                overrideParameters[key] = value;
            }
        }
    });

    readFileContents(runSettingsFile, "utf-8")
        .then(function (xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    tl.warning(tl.loc('ErrorWhileReadingRunSettings', err));
                    tl.debug("Error occured while overriding test run parameters. Continuing...");
                    defer.resolve(settingsFile);
                    return defer.promise;
                }

                if (result.RunSettings && result.RunSettings.TestRunParameters && result.RunSettings.TestRunParameters[0] &&
                    result.RunSettings.TestRunParameters[0].Parameter) {
                    var parametersArray = result.RunSettings.TestRunParameters[0].Parameter;
                    parametersArray.forEach(function (parameter) {
                        var key = parameter.$.name;
                        if (overrideParameters[key]) {
                            parameter.$.value = overrideParameters[key];
                        }
                    });
                    tl.debug("Overriding test run parameters.");
                    var builder = new xml2js.Builder();
                    var overridedRunSettings = builder.buildObject(result);
                    saveToFile(overridedRunSettings, runSettingsExt)
                        .then(function (fileName) {
                            defer.resolve(fileName);
                        })
                        .fail(function (err) {
                            tl.debug("Error occured while overriding test run parameters. Continuing...");
                            tl.warning(err);
                            defer.resolve(settingsFile);
                        });
                }
                else {
                    tl.debug("No test run parameters found to override.");
                    defer.resolve(settingsFile);
                }
            });
        })
        .fail(function (err) {
            tl.debug("Error occured while overriding test run parameters. Continuing...");
            tl.warning(err);
            defer.resolve(settingsFile);
        });
    return defer.promise;
}

function isNugetRestoredAdapterPresent(rootDirectory: string): boolean {
    var allFiles = tl.find(rootDirectory);
    var adapterFiles = tl.match(allFiles, "**\\packages\\**\\*TestAdapter.dll", { matchBase: true });
    if (adapterFiles && adapterFiles.length != 0) {
        for (var i = 0; i < adapterFiles.length; i++) {
            var adapterFile = adapterFiles[i];
            var packageIndex = adapterFile.indexOf('packages') + 7;
            var packageFolder = adapterFile.substr(0, packageIndex);
            var parentFolder = path.dirname(packageFolder);
            var solutionFiles = tl.match(allFiles, path.join(parentFolder, "*.sln"), { matchBase: true });
            if (solutionFiles && solutionFiles.length != 0) {
                return true;
            }
        }
    }
    return false;
}

function getTestResultsDirectory(settingsFile: string, defaultResultsDirectory: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    if (!settingsFile || !pathExistsAsFile(settingsFile)) {
        defer.resolve(defaultResultsDirectory);
        return defer.promise;
    }

    readFileContents(runSettingsFile, "utf-8")
        .then(function (xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function (err, result) {
                if (!err && result.RunSettings && result.RunSettings.RunConfiguration && result.RunSettings.RunConfiguration[0] &&
                    result.RunSettings.RunConfiguration[0].ResultsDirectory && result.RunSettings.RunConfiguration[0].ResultsDirectory[0].length > 0) {
                    var resultDirectory = result.RunSettings.RunConfiguration[0].ResultsDirectory[0];
                    resultDirectory = resultDirectory.trim();

                    if (resultDirectory) {
                        // path.resolve will take care if the result directory given in settings files is not absolute.
                        defer.resolve(path.resolve(path.dirname(runSettingsFile), resultDirectory));
                    }
                    else {
                        defer.resolve(defaultResultsDirectory);
                    }
                }
                else {
                    defer.resolve(defaultResultsDirectory);
                }
            });
        })
        .fail(function (err) {
            tl.debug("Error occured while reading test result directory from run settings. Continuing...")
            tl.warning(err);
            defer.resolve(defaultResultsDirectory);
        });
    return defer.promise;
}


function getTIAssemblyQualifiedName(vsVersion: number): String {
    return "Microsoft.VisualStudio.TraceCollector.TestImpactDataCollector, Microsoft.VisualStudio.TraceCollector, Version=" + vsVersion + ".0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a";
}

function getTestImpactAttributes(vsVersion: number) {
    return {
        uri: TICollectorURI,
        assemblyQualifiedName: getTIAssemblyQualifiedName(vsVersion),
        friendlyName: TIFriendlyName
    };
}

function isTestImapctCollectorPresent(dataCollectorArray): Boolean {
    var found = false;
    var tiaFriendlyName = TIFriendlyName.toUpperCase();
    for (var node of dataCollectorArray) {
        if (node.$.friendlyName && node.$.friendlyName.toUpperCase() === tiaFriendlyName) {
            tl.debug("Test impact data collector already present, will not add the node.");
            found = true;
            break;
        }
    }
    return found;
}

function updateRunSettings(result: any, vsVersion: number) {
    var dataCollectorNode = null;
    if (!result.RunSettings) {
        tl.debug("Updating runsettings file from RunSettings node");
        result.RunSettings = { DataCollectionRunSettings: { DataCollectors: { DataCollector: {} } } };
        dataCollectorNode = result.RunSettings.DataCollectionRunSettings.DataCollectors.DataCollector;
    }
    else if (!result.RunSettings.DataCollectionRunSettings) {
        tl.debug("Updating runsettings file from DataCollectionSettings node");
        result.RunSettings.DataCollectionRunSettings = { DataCollectors: { DataCollector: {} } };
        dataCollectorNode = result.RunSettings.DataCollectionRunSettings.DataCollectors.DataCollector;
    }
    else if (!result.RunSettings.DataCollectionRunSettings[0].DataCollectors) {
        tl.debug("Updating runsettings file from DataCollectors node");
        result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: { DataCollector: {} } };
        dataCollectorNode = result.RunSettings.DataCollectionRunSettings[0].DataCollectors.DataCollector;
    }
    else {
        var dataCollectorArray = result.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug("Updating runsettings file from DataCollector node");
            result.RunSettings.DataCollectionRunSettings[0] = { DataCollectors: { DataCollector: {} } };
            dataCollectorNode = result.RunSettings.DataCollectionRunSettings[0].DataCollectors.DataCollector;
        }
        else {
            if (!isTestImapctCollectorPresent(dataCollectorArray)) {
                tl.debug("Updating runsettings file, adding a DataCollector node");
                dataCollectorArray.push({});
                dataCollectorNode = dataCollectorArray[dataCollectorArray.length - 1];
            }
        }
    }
    if (dataCollectorNode) {
        tl.debug("Setting attributes for test impact data collector");
        dataCollectorNode.$ = getTestImpactAttributes(vsVersion);
    }
}

function updateRunSettingsFileForTestImpact(vsVersion: number, settingsFile: string, exitErrorMessage: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    tl.debug("Adding test impact data collector element to runsettings file provided.");
    readFileContents(settingsFile, "utf-8")
        .then(function (xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    tl.warning(tl.loc('ErrorWhileReadingRunSettings', err));
                    tl.debug(exitErrorMessage);
                    defer.resolve(settingsFile);
                    return defer.promise;
                }
                if (result.RunSettings === undefined) {
                    tl.warning(tl.loc('ErrorWhileSettingTestImpactCollectorRunSettings'));
                    defer.resolve(settingsFile);
                    return defer.promise;
                }
                updateRunSettings(result, vsVersion);
                writeXmlFile(result, settingsFile, runSettingsExt, exitErrorMessage)
                    .then(function (filename) {
                        defer.resolve(filename);
                        return defer.promise;
                    });
            });
        })
        .fail(function (err) {
            tl.warning(err);
            tl.debug(exitErrorMessage);
            defer.resolve(settingsFile);
        });
    return defer.promise;
}

function updatTestSettings(result: any, vsVersion: number) {
    var dataCollectorNode = null;
    if (!result.TestSettings) {
        tl.debug("Updating testsettings file from TestSettings node");
        result.TestSettings = { Execution: { AgentRule: { DataCollectors: { DataCollector: {} } } } };
        result.TestSettings.Execution.AgentRule.$ = { name: TITestSettingsAgentNameTag };
        result.TestSettings.$ = { name: TITestSettingsNameTag, id: TITestSettingsIDTag, xmlns: TITestSettingsXmlnsTag };
        dataCollectorNode = result.TestSettings.Execution.AgentRule.DataCollectors.DataCollector;
    }
    else if (!result.TestSettings.Execution) {
        tl.debug("Updating testsettings file from Execution node");
        result.TestSettings.Execution = { AgentRule: { DataCollectors: { DataCollector: {} } } };
        result.TestSettings.Execution.AgentRule.$ = { name: TITestSettingsAgentNameTag };
        dataCollectorNode = result.TestSettings.Execution.AgentRule.DataCollectors.DataCollector;
    }
    else if (!result.TestSettings.Execution[0].AgentRule) {
        tl.debug("Updating testsettings file from AgentRule node");
        result.TestSettings.Execution[0] = { AgentRule: { DataCollectors: { DataCollector: {} } } };
        result.TestSettings.Execution[0].AgentRule.$ = { name: TITestSettingsAgentNameTag };
        dataCollectorNode = result.TestSettings.Execution[0].AgentRule.DataCollectors.DataCollector;
    }
    else if (!result.TestSettings.Execution[0].AgentRule[0].DataCollectors) {
        tl.debug("Updating testsettings file from DataCollectors node");
        result.TestSettings.Execution[0].AgentRule[0] = { DataCollectors: { DataCollector: {} } };
        dataCollectorNode = result.TestSettings.Execution[0].AgentRule[0].DataCollectors.DataCollector;
    }
    else {
        var dataCollectorArray = result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0].DataCollector;
        if (!dataCollectorArray) {
            tl.debug("Updating testsettings file from DataCollector node");
            result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0] = { DataCollector: {} };
            dataCollectorNode = result.TestSettings.Execution[0].AgentRule[0].DataCollectors[0].DataCollector;
        }
        else {
            if (!isTestImapctCollectorPresent(dataCollectorArray)) {
                tl.debug("Updating testsettings file, adding a DataCollector node");
                dataCollectorArray.push({});
                dataCollectorNode = dataCollectorArray[dataCollectorArray.length - 1];
            }
        }
    }
    if (dataCollectorNode) {
        tl.debug("Setting attributes for test impact data collector");
        dataCollectorNode.$ = getTestImpactAttributes(vsVersion);
    }
}

function writeXmlFile(result: any, settingsFile: string, fileExt: string, exitErrorMessage: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var builder = new xml2js.Builder();
    var runSettingsForTestImpact = builder.buildObject(result);
    saveToFile(runSettingsForTestImpact, fileExt)
        .then(function (fileName) {
            cleanUp(settingsFile);
            defer.resolve(fileName);
            return defer.promise;
        })
        .fail(function (err) {
            tl.debug(exitErrorMessage);
            tl.warning(err);
            defer.resolve(settingsFile);
        });
    return defer.promise;
}

function updateTestSettingsFileForTestImpact(vsVersion: number, settingsFile: string, exitErrorMessage: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    tl.debug("Adding test impact data collector element to testsettings file provided.");
    readFileContents(settingsFile, "utf-8")
        .then(function (xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    tl.warning(tl.loc('ErrorWhileReadingTestSettings', err));
                    tl.debug(exitErrorMessage);
                    defer.resolve(settingsFile);
                    return defer.promise;
                }
                if (result.TestSettings === undefined) {
                    tl.warning(tl.loc('ErrorWhileSettingTestImpactCollectorTestSettings'));
                    defer.resolve(settingsFile);
                    return defer.promise;
                }
                updatTestSettings(result, vsVersion);
                writeXmlFile(result, settingsFile, testSettingsExt, exitErrorMessage)
                    .then(function (filename) {
                        defer.resolve(filename);
                        return defer.promise;
                    });
            });
        })
        .fail(function (err) {
            tl.warning(err);
            tl.debug(exitErrorMessage);
            defer.resolve(settingsFile);
        });
    return defer.promise;
}


function createRunSettingsForTestImpact(vsVersion: number, settingsFile: string, exitErrorMessage: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    tl.debug("No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector.");
    var runSettingsForTIA = '<?xml version="1.0" encoding="utf-8"?><RunSettings><DataCollectionRunSettings><DataCollectors>' +
        '<DataCollector uri="' + TICollectorURI + '" ' +
        'assemblyQualifiedName="' + getTIAssemblyQualifiedName(vsVersion) + '" ' +
        'friendlyName="' + TIFriendlyName + '"/>' +
        '</DataCollectors></DataCollectionRunSettings></RunSettings>';
    saveToFile(runSettingsForTIA, runSettingsExt)
        .then(function (fileName) {
            defer.resolve(fileName);
            return defer.promise;
        })
        .fail(function (err) {
            tl.debug(exitErrorMessage);
            tl.warning(err);
            defer.resolve(settingsFile);
        });
    return defer.promise;
}

function setupSettingsFileForTestImpact(vsVersion: number, settingsFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var exitErrorMessage = "Error occured while setting in test impact data collector. Continuing...";
    if (isTiaAllowed()) {
        if (settingsFile && settingsFile.split('.').pop().toLowerCase() == "testsettings") {
            updateTestSettingsFileForTestImpact(vsVersion, settingsFile, exitErrorMessage)
                .then(function (updatedFile) {
                    defer.resolve(updatedFile);
                    return defer.promise;
                });
        }
        else if (!settingsFile || settingsFile.split('.').pop().toLowerCase() != "runsettings" || !pathExistsAsFile(settingsFile)) {
            createRunSettingsForTestImpact(vsVersion, settingsFile, exitErrorMessage)
                .then(function (updatedFile) {
                    defer.resolve(updatedFile);
                    return defer.promise;
                });
        }
        else {
            updateRunSettingsFileForTestImpact(vsVersion, settingsFile, exitErrorMessage)
                .then(function (updatedFile) {
                    defer.resolve(updatedFile);
                    return defer.promise;
                });
        }
    }
    else {
        tl.debug("Settings are not sufficient for setting test impact. Not updating the settings file");
        defer.resolve(settingsFile);
    }
    return defer.promise;
}

function setupRunSettingsFileForParallel(runInParallel: boolean, settingsFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var exitErrorMessage = "Error occured while setting run in parallel. Continuing...";
    if (runInParallel) {
        if (settingsFile && settingsFile.split('.').pop().toLowerCase() == "testsettings") {
            tl.warning(tl.loc('RunInParallelNotSupported'));
            defer.resolve(settingsFile);
            return defer.promise;
        }

        if (!settingsFile || settingsFile.split('.').pop().toLowerCase() != "runsettings" || !pathExistsAsFile(settingsFile)) {
            tl.debug("No settings file provided or the provided settings file does not exist.");
            var runSettingsForParallel = '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><MaxCpuCount>0</MaxCpuCount></RunConfiguration></RunSettings>';
            saveToFile(runSettingsForParallel, runSettingsExt)
                .then(function (fileName) {
                    defer.resolve(fileName);
                    return defer.promise;
                })
                .fail(function (err) {
                    tl.debug(exitErrorMessage);
                    tl.warning(err);
                    defer.resolve(settingsFile);
                });
        }
        else {
            tl.debug("Adding maxcpucount element to runsettings file provided.");
            readFileContents(settingsFile, "utf-8")
                .then(function (xmlContents) {
                    var parser = new xml2js.Parser();
                    parser.parseString(xmlContents, function (err, result) {
                        if (err) {
                            tl.warning(tl.loc('ErrorWhileReadingRunSettings', err));
                            tl.debug(exitErrorMessage);
                            defer.resolve(settingsFile);
                            return defer.promise;
                        }

                        if (result.RunSettings === undefined) {
                            tl.warning(tl.loc('FailedToSetRunInParallel'));
                            defer.resolve(settingsFile);
                            return defer.promise;
                        }

                        if (!result.RunSettings) {
                            result.RunSettings = { RunConfiguration: { MaxCpuCount: 0 } };
                        }
                        else if (!result.RunSettings.RunConfiguration || !result.RunSettings.RunConfiguration[0]) {
                            result.RunSettings.RunConfiguration = { MaxCpuCount: 0 };
                        }
                        else {
                            var runConfigArray = result.RunSettings.RunConfiguration[0];
                            runConfigArray.MaxCpuCount = 0;
                        }

                        var builder = new xml2js.Builder();
                        var runSettingsForParallel = builder.buildObject(result);
                        saveToFile(runSettingsForParallel, runSettingsExt)
                            .then(function (fileName) {
                                cleanUp(settingsFile);
                                defer.resolve(fileName);
                                return defer.promise;
                            })
                            .fail(function (err) {
                                tl.debug(exitErrorMessage);
                                tl.warning(err);
                                defer.resolve(settingsFile);
                            });
                    });
                })
                .fail(function (err) {
                    tl.warning(err);
                    tl.debug(exitErrorMessage);
                    defer.resolve(settingsFile);
                });
        }
    }
    else {
        defer.resolve(settingsFile);
    }

    return defer.promise;
}

function saveToFile(fileContents: string, extension: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var tempFile = path.join(os.tmpdir(), uuid.v1() + extension);
    fs.writeFile(tempFile, fileContents, function (err) {
        if (err) {
            defer.reject(err);
        }
        tl.debug("Temporary runsettings file created at " + tempFile);
        defer.resolve(tempFile);
    });
    return defer.promise;
}

function setRunInParallellIfApplicable(vsVersion: number) {
    if (runInParallel) {
        if (!isNaN(vsVersion) && vsVersion >= 14) {
            var vs14Common = tl.getVariable("VS140COMNTools");
            if (vsVersion > 14 || (vs14Common && pathExistsAsFile(path.join(vs14Common, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\TE.TestModes.dll")))) {
                setRegistryKeyForParallelExecution(vsVersion);
                return;
            }
        }
        resetRunInParallel();
    }
}

function resetRunInParallel() {
    tl.warning(tl.loc('UpdateOneOrHigherRequired'));
    runInParallel = false;
}

function locateVSVersion(): Q.Promise<number> {
    var defer = Q.defer<number>();
    var vsVersion = parseFloat(vsTestVersion);
    if (!isNaN(vsVersion)) {
        defer.resolve(vsVersion);
        return defer.promise;
    }
    var regPath = "HKLM\\SOFTWARE\\Microsoft\\VisualStudio";
    regedit.list(regPath).on('data', function (entry) {
        if (entry && entry.data && entry.data.keys) {
            var subkeys = entry.data.keys;
            var versions = getFloatsFromStringArray(subkeys);
            if (versions && versions.length > 0) {
                versions.sort((a, b) => a - b);
                defer.resolve(versions[versions.length - 1]);
                return defer.promise;
            }
        }
        defer.resolve(null);
    });
    return defer.promise;
}

function getFloatsFromStringArray(inputArray: string[]): number[] {
    var outputArray: number[] = [];
    var count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            var floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(floatValue);
            }
        }
    }
    return outputArray;
}

function setRegistryKeyForParallelExecution(vsVersion: number) {
    var regKey = "HKCU\\SOFTWARE\\Microsoft\\VisualStudio\\" + vsVersion.toFixed(1) + "_Config\\FeatureFlags\\TestingTools\\UnitTesting\\Taef";
    regedit.createKey(regKey, function (err) {
        if (!err) {
            var values = {
                [regKey]: {
                    'Value': {
                        value: '1',
                        type: 'REG_DWORD'
                    }
                }
            };
            regedit.putValue(values, function (err) {
                if (err) {
                    tl.warning(tl.loc('ErrorOccuredWhileSettingRegistry', err));
                }
            });
        } else {
            tl.warning(tl.loc('ErrorOccuredWhileSettingRegistry', err));
        }
    });
}

function readFileContents(filePath: string, encoding: string): Q.Promise<string> {
    var defer = Q.defer<string>();

    fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
            defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
        }
        else {
            defer.resolve(data);
        }
    });

    return defer.promise;
}

function pathExistsAsFile(path: string) {
    return tl.exist(path) && tl.stats(path).isFile();
}

function pathExistsAsDirectory(path: string) {
    return tl.exist(path) && tl.stats(path).isDirectory();
}

function isNonEmptyResponseFile(responseFile: string): boolean {
    if (pathExistsAsFile(responseFile) && tl.stats(responseFile).size) {
        return true;
    }
    return false;
}

function isTiaAllowed(): boolean {
    if (tiaEnabled && tiaEnabled.toUpperCase() == "TRUE" && tiaSelectorTool) {
        return true;
    }
    return false;
}
