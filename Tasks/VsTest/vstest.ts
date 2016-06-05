/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');
var os = require('os');
var regedit = require('regedit');
var uuid = require('node-uuid');
var fs = require('fs');
var xml2js = require('xml2js');

try {
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
    
    //Write-Host "##vso[task.logissue type=warning;TaskName=VSTest]"

    var sourcesDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    var testAssemblyFiles = getTestAssemblies();

    if (testAssemblyFiles && testAssemblyFiles.size != 0) {
        var workingDirectory = path.join(sourcesDirectory, "..");
        getTestResultsDirectory(runSettingsFile, path.join(workingDirectory, 'TestResults')).then(function(resultsDirectory) {
            invokeVSTest(resultsDirectory).then(function(code) {
                try {
                    publishTestResults(resultsDirectory);
                    tl.setResult(code, tl.loc('VstestReturnCode', code));
                }
                catch (error) {
                    //Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
                    throw error;
                }
            })
                .fail(function(err) {
                    //Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
                    throw err;
                });
        });
    }
    else {
        //Write-Host "##vso[task.logissue type=warning;code=002004;]"
        tl.warning("No test assemblies found matching the pattern: " + testAssembly);
    }
}
catch (error) {
    //Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
    throw error;
}

function getTestAssemblies(): Set<string> {
    var testAssemblyFiles = [];
    if (testAssembly.indexOf('*') >= 0 || testAssembly.indexOf('?') >= 0) {
        tl.debug('Pattern found in solution parameter.');
        var excludeTestAssemblies = [];
        var allFiles = tl.find(sourcesDirectory);
        var testAssemblyFilters = testAssembly.split(';');
        testAssemblyFilters.forEach(function(testAssemblyFilter) {
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
        testAssemblyFiles = testAssemblyFiles.filter(x=> excludeTestAssemblies.indexOf(x) < 0);
    }
    else {
        tl.debug('No Pattern found in solution parameter.');
        var assemblies = testAssembly.split(';');
        assemblies.forEach(function(assembly) {
            testAssemblyFiles.push(assembly);
        });
    }
    return new Set(testAssemblyFiles);
}

function invokeVSTest(testResultsDirectory: string): Q.Promise<number> {
    var defer = Q.defer<number>();
    if (vsTestVersion == "latest") {
        vsTestVersion = null;
    }
    overrideTestRunParametersIfRequired(runSettingsFile).then(function(overriddenSettingsFile) {
        locateVSVersion().then(function(vsVersion) {
            setRunInParallellIfApplicable(vsVersion);
            setupRunSettingsFileForParallel(overriddenSettingsFile).then(function(parallelRunSettingsFile) {
                var vsCommon = tl.getVariable("VS" + vsVersion + "0COMNTools");
                var vstestLocation = path.join(vsCommon, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe");
                var vstest = tl.createToolRunner(vstestLocation);

                testAssemblyFiles.forEach(function(testAssembly) {
                    var testAssemblyPath = testAssembly;
                    //To maintain parity with the behaviour when test assembly was filepath, try to expand it relative to build sources directory.
                    if (sourcesDirectory && !pathExistsAsFile(testAssembly)) {
                        var expandedPath = path.join(sourcesDirectory, testAssembly);
                        if (pathExistsAsFile(expandedPath)) {
                            testAssemblyPath = expandedPath;
                        }
                    }
                    vstest.arg(testAssemblyPath);
                });

                if (testFiltercriteria) {
                    vstest.arg("/TestCaseFilter:" + testFiltercriteria);
                }

                if (parallelRunSettingsFile && pathExistsAsFile(parallelRunSettingsFile)) {
                    vstest.arg("/Settings:" + parallelRunSettingsFile);
                }

                if (codeCoverageEnabled) {
                    vstest.arg("/EnableCodeCoverage");
                }

                if (otherConsoleOptions) {
                    vstest.arg(otherConsoleOptions);
                }

                vstest.arg("/logger:trx");

                if (pathtoCustomTestAdapters) {
                    if (pathExistsAsDirectory(pathtoCustomTestAdapters)) {
                        vstest.arg("/TestAdapterPath:\"" + pathtoCustomTestAdapters + "\"");
                    }
                    else {
                        vstest.arg("/TestAdapterPath:\"" + path.dirname(pathtoCustomTestAdapters) + "\"");
                    }
                }
                else if (sourcesDirectory && isNugetRestoredAdapterPresent(sourcesDirectory)) {
                    vstest.arg("/TestAdapterPath:\"" + sourcesDirectory + "\"");
                }

                tl.rmRF(testResultsDirectory, true);
                tl.mkdirP(testResultsDirectory);
                tl.cd(workingDirectory);
                vstest.exec().then(function(code) {
                    cleanUp(parallelRunSettingsFile);
                    defer.resolve(code);
                })
                    .fail(function(err) {
                        cleanUp(parallelRunSettingsFile);
                        tl.warning("Vstest failed with error. Check logs for failures. There might be failed tests");
                        tl.error(err);
                        defer.resolve(1);
                    });
            })
                .fail(function(err) {
                    tl.error(err);
                    defer.resolve(1);
                });
        })
            .fail(function(err) {
                tl.error(err);
                defer.resolve(1);
            });
    })
        .fail(function(err) {
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
            //Write-Host "##vso[task.logissue type=warning;code=002003;]"
            tl.warning("No results found to publish.");
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
        tl.rmRF(temporarySettingsFile, true);
    }
}

function overrideTestRunParametersIfRequired(settingsFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    if (!settingsFile || !pathExistsAsFile(settingsFile) || !overrideTestrunParameters || overrideTestrunParameters.trim().length == 0) {
        defer.resolve(settingsFile);
    }
    else {
        overrideTestrunParameters = overrideTestrunParameters.trim();
        var overrideParameters = {};

        var parameterStrings = overrideTestrunParameters.split(";");
        parameterStrings.forEach(function(parameterString) {
            var pair = parameterString.split("=", 2);
            if (pair.length == 2) {
                var key = pair[0];
                var value = pair[1];
                if (!overrideParameters[key]) {
                    overrideParameters[key] = value;
                }
            }
        });

        readFileContents(runSettingsFile, "utf-8").then(function(xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function(err, result) {
                if (err) {
                    tl.warning("Error occured while reading run settings file. Error : " + err);
                    tl.debug("Error occured while overriding test run parameters. Continuing...");
                    defer.resolve(settingsFile);
                }
                else {
                    if (result.RunSettings && result.RunSettings.TestRunParameters && result.RunSettings.TestRunParameters[0] &&
                        result.RunSettings.TestRunParameters[0].Parameter) {
                        var parametersArray = result.RunSettings.TestRunParameters[0].Parameter;
                        parametersArray.forEach(function(parameter) {
                            var key = parameter.$.name;
                            if (overrideParameters[key]) {
                                parameter.$.value = overrideParameters[key];
                            }
                        });
                        tl.debug("Overriding test run parameters.");
                        var builder = new xml2js.Builder();
                        var overridedRunSettings = builder.buildObject(result);
                        saveToFile(overridedRunSettings).then(function(fileName) {
                            defer.resolve(fileName);
                        })
                            .fail(function(err) {
                                tl.debug("Error occured while overriding test run parameters. Continuing...");
                                tl.warning(err);
                                defer.resolve(settingsFile);
                            });
                    }
                    else {
                        tl.debug("No test run parameters found to override.");
                        defer.resolve(settingsFile);
                    }
                }
            });
        })
            .fail(function(err) {
                tl.debug("Error occured while overriding test run parameters. Continuing...");
                tl.warning(err);
                defer.resolve(settingsFile);
            });
    }
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
    }
    else {
        readFileContents(runSettingsFile, "utf-8").then(function(xmlContents) {
            var parser = new xml2js.Parser();
            parser.parseString(xmlContents, function(err, result) {
                if (!err && result.RunSettings && result.RunSettings.RunConfiguration && result.RunSettings.RunConfiguration[0] &&
                    result.RunSettings.RunConfiguration[0].ResultsDirectory && result.RunSettings.RunConfiguration[0].ResultsDirectory[0].length > 0) {
                    defer.resolve(result.RunSettings.RunConfiguration[0].ResultsDirectory[0]);
                }
                else {
                    defer.resolve(defaultResultsDirectory);
                }
            });
        })
            .fail(function(err) {
                tl.debug("Error occured while reading test result directory from run settings. Continuing...")
                tl.warning(err);
                defer.resolve(defaultResultsDirectory);
            });
    }
    return defer.promise;
}

function setupRunSettingsFileForParallel(settingsFile: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    if (runInParallel) {
        if (settingsFile && settingsFile.split('.').pop().toLowerCase() == "testsettings") {
            tl.warning("Run in Parallel is not supported with testsettings file.");
            defer.resolve(settingsFile);
        }
        else {
            if (!settingsFile || settingsFile.split('.').pop().toLowerCase() != "runsettings" || !pathExistsAsFile(settingsFile)) {
                tl.debug("No settings file provided or the provided settings file does not exist.");
                var runSettingsForParallel = '<?xml version="1.0" encoding="utf-8"?><RunSettings><RunConfiguration><MaxCpuCount>0</MaxCpuCount></RunConfiguration></RunSettings>';
                saveToFile(runSettingsForParallel).then(function(fileName) {
                    defer.resolve(fileName);
                    return defer.promise;
                })
                    .fail(function(err) {
                        tl.debug("Error occured while setting run in parallel. Continuing...");
                        tl.warning(err);
                        defer.resolve(settingsFile);
                    });
            }
            else {
                tl.debug("Adding maxcpucount element to runsettings file provided.");
                readFileContents(settingsFile, "utf-8").then(function(xmlContents) {
                    var parser = new xml2js.Parser();
                    parser.parseString(xmlContents, function(err, result) {
                        if (err) {
                            tl.warning("Error occured while reading run settings file. Error : " + err);
                            tl.debug("Error occured while setting run in parallel. Continuing...");
                            defer.resolve(settingsFile);
                        }
                        else {
                            if (result.RunSettings === undefined) {
                                tl.warning("Failed to set run in parallel. Invalid run settings file.");
                                defer.resolve(settingsFile);
                            }
                            else if (!result.RunSettings) {
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
                            saveToFile(runSettingsForParallel).then(function(fileName) {
                                cleanUp(settingsFile);
                                defer.resolve(fileName);
                                return defer.promise;
                            })
                                .fail(function(err) {
                                    tl.debug("Error occured while setting run in parallel. Continuing...");
                                    tl.warning(err);
                                    defer.resolve(settingsFile);
                                });
                        }
                    });
                })
                    .fail(function(err) {
                        tl.warning(err);
                        tl.debug("Error occured while setting run in parallel. Continuing...");
                        defer.resolve(settingsFile);
                    });
            }
        }
    }
    else {
        defer.resolve(settingsFile);
    }

    return defer.promise;
}

function saveToFile(fileContents: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var tempFile = path.join(os.tmpdir(), uuid.v1() + ".runsettings");
    fs.writeFile(tempFile, fileContents, function(err) {
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
            if ((vs14Common && pathExistsAsFile(path.join(vs14Common, "..\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\TE.TestModes.dll"))) || vsVersion > 14) {
                setRegistryKeyForParallelExecution(vsVersion);
                return;
            }
        }
    }
}

function resetRunInParallel() {
    tl.warning("Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel.");
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
    regedit.list(regPath).on('data', function(entry) {
        if (entry && entry.data && entry.data.keys) {
            var subkeys = entry.data.keys;
            var versions = getFloatsFromStringArray(subkeys);
            if (versions && versions.length > 0) {
                versions.sort();
                defer.resolve(parseFloat(versions[versions.length - 1]));
                return defer.promise;
            }
        }
        defer.resolve(null);
    });
    return defer.promise;
}

function getFloatsFromStringArray(inputArray: string[]): string[] {
    var outputArray: string[] = []
    var count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            var floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(inputArray[count]);
            }
        }
    }
    return outputArray;
}

function setRegistryKeyForParallelExecution(vsVersion: number) {
    var regKey = "HKCU\\SOFTWARE\\Microsoft\\VisualStudio\\" + vsVersion.toFixed(1) + "_Config\\FeatureFlags\\TestingTools\\UnitTesting\\Taef";
    regedit.createKey(regKey, function(err) {
        if (!err) {
            var values = {
                [regKey]: {
                    'Value': {
                        value: '1',
                        type: 'REG_DWORD'
                    }
                }
            };
            regedit.putValue(values, function(err) {
                if (err) {
                    tl.warning("Error occured while setting registry key, Error: " + err);
                }
            });
        } else {
            tl.warning("Error occured while creating registry key, Error: " + err);
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