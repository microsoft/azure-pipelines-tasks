/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import os = require('os');
import mockHelper = require('../../lib/mockHelper');
import fs = require('fs');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('VsTest Suite', function () {
    this.timeout(20000);

    before((done) => {
        if (ps) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        psr.kill();
    });

    if (ps) {
        it('(VsTest-NoTestAssemblies) throws if no test assemblies provided as input', (done) => {
            psr.run(path.join(__dirname, 'ThrowsIfAssembliesNotProvided.ps1'), done);
        })
        it('(VsTest-NoSourceDirectory) throws if no source directory is found', (done) => {
            psr.run(path.join(__dirname, 'ThrowsIfNoSourceDirectoryFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueIfTaefFileIsFound) returns true if taef file is found', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsTrueIfTaefFileIsFound.ps1'), done);
        })
        it('(2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1) returns false if vstest version less than 14', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsFalseForOlderVSTestVersion.ps1'), done);
        })
        it('(2015U1Check.ReturnsTrueForLaterVSTestVersion) returns true if vstest version greater than 14', (done) => {
            psr.run(path.join(__dirname, '2015U1Check.ReturnsTrueForLaterVSTestVersion.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse) returns same file if parallel flag is false', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsFalse.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty) returns new file if parallel flag is true and no runsettings file is provided', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameEmpty.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty) returns same but updated file if parallel flag is true and a runsettings file is provided', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameNotEmpty.ps1'), done);
        })
        it('(NoResultsFile.PrintsWarning) prints a warning if no results file is found', (done) => {
            psr.run(path.join(__dirname, 'NoResultsFile.PrintsWarning.ps1'), done);
        })
        it('(NoTestAssemblies.PrintsWarning) prints a warning if no test assemblies are found', (done) => {
            psr.run(path.join(__dirname, 'NoTestAssemblies.PrintsWarning.ps1'), done);
        })
        it('(Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask) does not throw if publishattachments is not found in the cmdlet', (done) => {
            psr.run(path.join(__dirname, 'Compat.OptOutOfPublishNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(Compat.TestRunTitleNotInCmdlet.ProvidedByTask) does not throw if testrun title is not found in the cmdlet', (done) => {
            psr.run(path.join(__dirname, 'Compat.TestRunTitleNotInCmdlet.ProvidedByTask.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory) returns new file if parallel flag is true and runsettings input is a directory', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsADirectory.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsNonTestSettingsFile) returns new file if parallel flag is true and runsettings input is not a runsettings or testsettings file', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsNewFileIfParallelIsTrueAndFileNameIsANonRunsettingsNonTestSettingsFile.ps1'), done);
        })
        it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psr.run(path.join(__dirname, 'ValidateTestAssembliesAreSplit.ps1'), done);
        })
        it('ValidateTestAssembliesAreSplit) tests if the input test assembiles are properly passed to cmdlet', (done) => {
            psr.run(path.join(__dirname, 'ValidateTestAssembliesAreNotSplit.ps1'), done);
        })
        it('(RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameIsTestSettingsFile) returns same file if parallel flag is true and runsettings input is a testsettings file', (done) => {
            psr.run(path.join(__dirname, 'RunSettingsForParallel.ReturnsSameFileIfParallelIsTrueAndFileNameIsTestSettingsFile.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathFromRunsettings) returns the custom results location from runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathFromRunsettings.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathFromRunsettingsForRelativePaths) returns the custom results location from runsettings for relative paths', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathFromRunsettingsForRelativePaths.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForRunsettingsWithoutResultsDirectory) returns null if there is no results location in runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForRunsettingsWithoutResultsDirectory.ps1'), done);
        })

        it('(GetResultsLocationReturnsPathForTmpFile) returns the custom results location for tmp file extension', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsPathForTmpFile.ps1'), done);
        })

        it('(GetResultsReturnsNullForTestsettings) returns null for any other file type', (done) => {
            psr.run(path.join(__dirname, 'GetResultsReturnsNullForTestsettings.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForDirectory) returns the null for directory specified as runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForDirectory.ps1'), done);
        })

        it('(GetResultsLocationReturnsNullForEmptyPath) returns null for empty directory specified as runsettings', (done) => {
            psr.run(path.join(__dirname, 'GetResultsLocationReturnsNullForEmptyPath.ps1'), done);
        })

        it('(TestResultsDirectoryVariableIsUsedIfnorunsettings) vstest invoked with  default test results directory if no settings is specified', (done) => {
            psr.run(path.join(__dirname, 'TestResultsDirectoryVariableIsUsedIfnorunsettings.ps1'), done);
        })

        it('(TestResultsDirectoryVariableIsUsedIfOverrideParamsAreUsed) vstest invoked with  default test results directory if override run parameters is used', (done) => {
            psr.run(path.join(__dirname, 'TestResultsDirectoryVariableIsUsedIfOverrideParamsAreUsed.ps1'), done);
        })
    }

    if (!os.type().match(/^Win/)) {
        console.log("Skipping vstest tests. Vstest tests run only on windows.")
        return;
    }

    it('Vstest task without test results files input', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdErrContained('Input required: testAssembly'));
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test results files filter', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe some/path/one some/path/two /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test results files filter and exclude filter', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'some/*pattern;-:exclude/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe some/path/one /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test results files as path', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task when vstest fails', (done) => {
        setResponseFile('vstestFails.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe some/path/one some/path/two /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish/) < 0, 'should not have published test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task when vstest of specified version is not found', (done) => {
        setResponseFile('vstestFails.json'); // this response file does not have vs 2013
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '12.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(!tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should not have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish/) < 0, 'should not have published test results.');
                assert(tr.stdout.search(/Vstest of version 12 is not found. Try again with a visual studio version that exists on your build agent machine./) >= 0, 'should have displayed warning.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test case filter', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('testFiltercriteria', 'testFilter');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /TestCaseFilter:testFilter /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with enable code coverage', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('codeCoverageEnabled', 'true');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /EnableCodeCoverage /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with other console options', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('otherConsoleOptions', 'consoleOptions');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file consoleOptions /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with settings file', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', "settings.runsettings");

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /Settings:settings.runsettings /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2013', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '12.0');
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel./) >= 0, 'should have given a warning for update1 or higher requirement');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2014 below update1', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0'); // response file sets below update1
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel./) >= 0, 'should have given a warning for update1 or higher requirement');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2015', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '15.0');
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update1 or higher requirement');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2014 update1 or higher', (done) => {
        setResponseFile('vstestRunInParallel.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0'); // response file sets above update1
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update1 or higher requirement.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with custom adapter path', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('pathtoCustomTestAdapters', "path/to/customadapters");

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /logger:trx /TestAdapterPath:path/to/customadapters'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with runsettings file and tia.enabled set to false', (done) => {
        setResponseFile('vstestGoodWithTiaDisabled.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', "settings.runsettings");

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /Settings:settings.runsettings /logger:trx'), 'should have run vstest');
                var result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with runsettings file and tia.enabled undefined', (done) => {
        setResponseFile('vstestGood.json');

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', "settings.runsettings");

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe path/to/file /Settings:settings.runsettings /logger:trx'), 'should have run vstest');
                var result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with results directory as absolute path in run settings file', (done) => {
        var settingsFilePath = path.join(__dirname, 'data', 'ResultsDirectoryWithAbsolutePath.runsettings');
        var resultsDirectory = 'C:\\test'; // settings file has this result directory.

        var responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        var newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                assert(tr.stdout.indexOf("creating path: " + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with results directory as relative path in run settings file', (done) => {
        var settingsFilePath = path.join(__dirname, 'data', 'ResultsDirectoryWithRelativePath.runsettings');
        var resultsDirectory = path.join(__dirname, 'data', 'result'); // settings file has this result directory.

        var responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        var newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                //vstest task reads result directory from settings file and creates it.
                assert(tr.stdout.indexOf("creating path: " + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with results directory empty in run settings file', (done) => {
        var settingsFilePath = path.join(__dirname, 'data', 'RunSettingsWithoutResultsDirectory.runsettings');
        var resultsDirectory = '\\source\\dir\\TestResults'; // when results directory is empty in settings file, default result directory should be considered.

        var responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        var newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                //vstest task reads result directory from settings file and creates it.
                assert(tr.stdout.indexOf("creating path: " + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with custom vstest.console.exe path', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', 'some\\path\\to\\vstest.console.exe');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('some\\path\\to\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with custom vstest.console.exe path should throw on illegal path', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', 'some\\illegal\\path\\to\\vstest.console.exe');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                assert(tr.stdout.indexOf('some\\illegal\\path\\to\\vstest.console.exe path does not exist.') >= 0, 'should have written to stderr. error: ' + tr.stdout);
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task specifying vstest.console directory in vstest location', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', '\\path\\to\\vstest\\directory');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\path\\to\\vstest\\directory\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task should not use diag option when system.debug is not set', (done) => {
        setResponseFile('vstestGood.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', '\\path\\to\\vstest\\directory');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\path\\to\\vstest\\directory\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.indexOf('/diag') < 0, '/diag option should not be used for vstest.console.exe');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task should not use diag option when system.debug is set to false', (done) => {
        setResponseFile('vstestGoodSysDebugFalse.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', '\\path\\to\\vstest\\directory');
        tr.setInput('testAssembly', 'path/to/file');
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\path\\to\\vstest\\directory\\vstest.console.exe path/to/file /logger:trx'), 'should have run vstest');
                assert(tr.stdout.indexOf('/diag') < 0, '/diag option should not be used for vstest.console.exe');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task test results drop location in release definition', (done) => {
        setResponseFile('vstestRM.json');
        var tr = new trm.TaskRunner('VSTest');
        tr.setInput('testAssembly', 'some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran('\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe some/path/one some/path/two /logger:trx'), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

});