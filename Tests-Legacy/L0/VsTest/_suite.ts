/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import os = require('os');
import mockHelper = require('../../lib/mockHelper');
import fs = require('fs');
import shell = require('shelljs');

var ps = shell.which('powershell.exe');
var psr = null;
const sysVstestLocation = '\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe';
const sysVstest15Location = '\\vs2017\\installation\\folder\\Common7\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe';

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

    if (!os.type().match(/^Win/)) {
        console.log('Skipping vstest tests. Vstest tests run only on windows.')
        return;
    }
  
    it('Vstest task without test results files input', (done) => {
        setResponseFile('vstestGood.json');
        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
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

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');       
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('VSTest task with VS2017 installed on build agent and latest option is selected in definition', (done) => {

        let vstestCmd = ['\\somepath\\vstest.console.exe', '/path/to/test.dll', '/logger:trx'].join(' ');
        setResponseFile('vs2017.json');

        let tr = new trm.TaskRunner('VSTest', false, true, true);
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/path/to/test.dll');
        tr.setInput('vsTestVersion', 'latest');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result' + tr.stderr + tr.stdout);
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr + tr.stdout);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest' + tr.stdout + tr.stderr);
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test results files filter and exclude filter', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');       
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern\n!/source/dir/some/*excludePattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test results files as path', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task when vstest fails', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestFails.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish/) < 0, 'should not have published test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task when vstest is set to ignore test failures', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestSucceedsOnIgnoreFailure.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');            
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should have not written to stderr. error: ' + tr.stderr);
                assert(!tr.failed, 'task should not have failed');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish/) < 0, 'should not have published test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with test case filter', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/TestCaseFilter:testFilter', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('testFiltercriteria', 'testFilter');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with enable code coverage', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/EnableCodeCoverage', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');                
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('codeCoverageEnabled', 'true');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with settings file', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with invalid settings file', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'random.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length != 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.search(/The specified settings/) >= 0, 'should print error');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2013', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '12.0');
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) >= 0, 'should have given a warning for update3 or higher requirement');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2015 below update1', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0'); // response file sets below update1
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) >= 0, 'should have given a warning for update1 or higher requirement');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2017', (done) => {
        setResponseFile('vstestGoodRunInParallel.json');
        let tr = new trm.TaskRunner('VSTest', false, true, true); // normalize slash, ignore temp path, enable regex match
      
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '15.0');
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update3 or higher requirement');
                done();
            })
            .fail((err) => {
                console.log(tr.stderr);
                console.log(tr.stdout);
                done(err);
            });
    })

    it('Vstest task with run in parallel and vs 2015 update3 or higher', (done) => {
        setResponseFile('vstestRunInParallel.json');

        let tr = new trm.TaskRunner('VSTest', false, true, true); // normalize slash, ignore temp path, enable regex match
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0'); // response file sets above update1
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update3 or higher requirement.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with custom adapter path', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/TestAdapterPath:path/to/customadapters'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('pathtoCustomTestAdapters', 'path/to/customadapters');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    })

    it('Vstest task with Nuget restored adapter path', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/TestAdapterPath:/source/dir'].join(' ');
        setResponseFile('vstestGoodwithNugetAdapter.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    })

    it('Vstest task with runsettings file and tia.enabled set to false', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGoodWithTiaDisabled.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                let result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Vstest task with runsettings file and tia.enabled undefined', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                let result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    })

    it('Vstest task with results directory as absolute path in run settings file', (done) => {

        let settingsFilePath = path.join(__dirname, 'data', 'ResultsDirectoryWithAbsolutePath.runsettings');
        let resultsDirectory = 'C:\\test'; // settings file has this result directory.

        let responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        let responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        let newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');

        setResponseFile(path.basename(newResponseFilePath));

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                assert(tr.stdout.indexOf('creating path: ' + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with results directory as relative path in run settings file', (done) => {

        const settingsFilePath = path.join(__dirname, 'data', 'ResultsDirectoryWithRelativePath.runsettings');
        const resultsDirectory = path.join(__dirname, 'data', 'result'); // settings file has this result directory.

        const responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        let responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        const newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile(path.basename(newResponseFilePath));

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                //vstest task reads result directory from settings file and creates it.
                assert(tr.stdout.indexOf('creating path: ' + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with results directory empty in run settings file', (done) => {

        const settingsFilePath = path.join(__dirname, 'data', 'RunSettingsWithoutResultsDirectory.runsettings');
        const resultsDirectory = '\\source\\dir\\TestResults'; // when results directory is empty in settings file, default result directory should be considered.

        const responseJsonFilePath: string = path.join(__dirname, 'vstestGood.json');
        let responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, [settingsFilePath, resultsDirectory]);
        const newResponseFilePath: string = path.join(__dirname, 'newresponse.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile(path.basename(newResponseFilePath));

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', settingsFilePath);

        tr.run()
            .then(() => {
                //vstest task reads result directory from settings file and creates it.
                assert(tr.stdout.indexOf('creating path: ' + resultsDirectory) >= 0, 'should have created results directory.');
                done();
            })
            .fail((err) => {
                done(err);
            });
});

    it('Vstest task should not use diag option when system.debug is not set', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');        
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                console.log(tr.stderr.length);
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('/diag') < 0, '/diag option should not be used for vstest.console.exe');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task should not use diag option when system.debug is set to false', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGoodSysDebugFalse.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version'); 
        tr.setInput('vsTestVersion', '14.0');
        tr.run()
            .then(() => {
                console.log('The errors are..........' + tr.stderr);
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('/diag') < 0, '/diag option should not be used for vstest.console.exe');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task verify test results are dropped at correct location in case of release', (done) => {

        const vstestCmd = [sysVstestLocation, '/artifacts/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestRM.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');        
        tr.setInput('testAssemblyVer2', '/artifacts/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=\\artifacts\\dir\\TestResults\\a.trx;\]/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
				console.log(tr.stdout);
				console.log(err);
                done(err);
            });
    });

    it('Vstest task with serach directory input', (done) => {

        const vstestCmd = [sysVstestLocation, '/search/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/search/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('searchDirectory', '/search/dir')
        tr.run()
            .then(() => {
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('/diag') < 0, '/diag option should not be used for vstest.console.exe');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with single otherConsoleOptions', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/UseVsixExtensions'].join(' ');
        setResponseFile('vstestOtherConsoleOptions.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('otherConsoleOptions', '/UseVsixExtensions');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('running vstest with other console params single..') >= 0, 'should have proper console output.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest task with multiple otherConsoleOptions', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/UseVsixExtensions', '/Enablecodecoverage'].join(' ');
        setResponseFile('vstestOtherConsoleOptions.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('otherConsoleOptions', '/UseVsixExtensions /Enablecodecoverage');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('running vstest with other console params multiple..') >= 0, 'should have proper console output.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest task with /Enablecodecoverage as otherConsoleOptions as well as Code Coverage enabled in UI', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/EnableCodeCoverage', '/logger:trx', '/Enablecodecoverage'].join(' ');
        setResponseFile('vstestOtherConsoleOptions.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('otherConsoleOptions', '/Enablecodecoverage');
        tr.setInput('codeCoverageEnabled', 'true');

        tr.run()
            .then(() => {                
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.failed, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.indexOf('running vstest with other console duplicate params..') >= 0, 'should have proper console output.');                
                assert(tr.stdout.indexOf('The parameter \"/EnableCodeCoverage\" should be provided only once.') >= 0, 'should have code coverage duplicate issue.');
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]Error: \\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe failed with return code: 1') >= 0, 'should have proper error message.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest should throw proper error for invalid vstest.console.exe location', (done) => {

        setResponseFile('vstestInvalidVstestPath.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'location');
        tr.setInput('vstestLocation', 'C:/vstest.console.exe');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('C:/vstest.console.exe path does not exist') >= 0, 'should throw invalid path error');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

});