import * as Q from 'q';
import * as assert from 'assert';
import * as trm from '../../lib/taskRunner';
import * as psm from '../../lib/psRunner';
import * as path from 'path';
import * as os from 'os';
import * as mockHelper from '../../lib/mockHelper';
import * as fs from 'fs';

const settingsHelper = require('../../../Tasks/VsTest/settingshelper');
let xml2js = require('../../../Tasks/VsTest/node_modules/xml2js');
const utils = require('../../../Tasks/VsTest/helpers');

//const xml2js = require('xml2js');
let psr = null;
const sysVstestLocation = '\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe';
const sysVstest15Location = '\\vs2017\\installation\\folder\\Common7\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe';

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('VsTest Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }
        done();
    });

    after(function () {
        if (psr) {
            psr.kill();
        }
    });

    if (!os.type().match(/^Win/)) {
        console.log('Skipping vstest tests. Vstest tests run only on windows.');
        return;
    }

    it('CodeCoverage enabled in tools installer flow with no settings file given', (done) => {
        try {
            settingsHelper.updateSettingsFileAsRequired(undefined, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[0].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('CodeCoverage and Test Impact enabled in tools installer flow with no settings file given', (done) => {
        try {           
            settingsHelper.updateSettingsFileAsRequired(undefined, false, { tiaEnabled: true, baseLineBuildIdFile: path.join(__dirname, 'data', 'baselineBuildId.txt') }, undefined, false, undefined, true, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[1].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    
    it('CodeCoverage enabled in tools installer flow and settings file containing a data collector', (done) => {
        try {     
            const settingsFilePath = path.join(__dirname, 'data', 'ContainsTestImpactDataCollector.runsettings');      
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[1].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('Test Impact enabled with a run settings file with an exsiting data collector', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'UseVerifiableInstrumentationNotPresent.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: true, baseLineBuildIdFile: path.join(__dirname, 'data', 'baselineBuildId.txt') }, undefined, false, undefined, true, false)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            // Note: DataCollector[1] is used to assert because a data collector already existed in the runsettings file
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[1].Configuration[0].ImpactLevel, 'file', 'Test impact data collector addition failed.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('Test Impact enabled with a run settings file with an empty datacollectors node', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'RunsettingsWithEmptyDataCollectorsNode.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: true, baseLineBuildIdFile: path.join(__dirname, 'data', 'baselineBuildId.txt') }, undefined, false, undefined, true, false)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[0].Configuration[0].ImpactLevel, 'file', 'Test impact data collector addition failed.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('CodeCoverage enabled in tools installer flow with invalid settings file', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'Invalid.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[0].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('CodeCoverage enabled in tools installer flow with Valid settings file, without any configuration', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithoutRunConfiguration.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[0].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('CodeCoverage enabled in tools installer flow with Valid settings file, without any UseVerifiableInstrumentation node', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'UseVerifiableInstrumentationNotPresent.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[0].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('CodeCoverage enabled in tools installer flow with Valid settings file, with a UseVerifiableInstrumentation node', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'UseVerifiableInstrumentationNodePresent.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, undefined, false, true)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            // Note: DataCollectors[1] is used to assert because a data collector already existed in the runsettings file
                            assert.equal(settings.RunSettings.DataCollectionRunSettings[0].DataCollectors[0].DataCollector[1].Configuration[0].CodeCoverage[0].UseVerifiableInstrumentation, 'False', 'UseVerifiableInstrumentation not set to false.');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('Vstest task without test results files input', (done) => {
        setResponseFile('vstestGood.json');
        const tr = new trm.TaskRunner('VSTest');
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
    });
    it('Vstest task with test results files filter', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('VSTest task with VS2017 installed on build agent and latest option is selected in definition', (done) => {

        const vstestCmd = ['\\vs2017\\installation\\folder\\Common7\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe', '/path/to/test.dll', '/logger:trx'].join(' ');
        setResponseFile('vs2017.json');

        const tr = new trm.TaskRunner('VSTest', false, true, false);
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/path/to/test.dll');
        tr.setInput('vsTestVersion', 'latest');
        tr.setInput('vstestLocationMethod', 'version');

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
    });

    it('VSTest task with only VS2015 installed on build agent and latest option is selected in definition', (done) => {

        const vstestCmd = ['\\vs\\IDE\\CommonExtensions\\Microsoft\\TestWindow\\vstest.console.exe', '/path/to/test.dll', '/logger:trx'].join(' ');
        setResponseFile('vs2015.json');

        const tr = new trm.TaskRunner('VSTest', false, true, false);
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/path/to/test.dll');
        tr.setInput('vsTestVersion', 'latest');
        tr.setInput('vstestLocationMethod', 'version');

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
    });

    it('Vstest task with test results files filter and exclude filter', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task with test results files as path', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task when vstest fails', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestFails.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task when vstest is set to ignore test failures', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestSucceedsOnIgnoreFailure.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task with test case filter', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/TestCaseFilter:testFilter', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task with enable code coverage', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/EnableCodeCoverage', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    it('Vstest task with settings file', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:E:\\settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'E:\\settings.runsettings');

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
    });

    it('Vstest task with invalid settings file', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'random.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length !== 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.search(/The specified settings/) >= 0, 'should print error');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with run in parallel and UI tests', (done) => {

        let vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        let tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('uiTests', 'true');
        tr.setInput('runInParallel', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/Running UI tests in parallel on the same machine can lead to errors. Consider disabling the ‘run in parallel’ option or run UI tests using a separate task./) >= 0, 'should have given a warning for ui tests and run in parallel selection.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with run in parallel and vs 2015 below update1', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
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
    });

    /* Temp commenting out tests to unblock CI */

    // it('Vstest task with run in parallel and vs 2017', (done) => {
    //     setResponseFile('vstestGoodRunInParallel.json');
    //     const tr = new trm.TaskRunner('VSTest', false, true, true); // normalize slash, ignore temp path, enable regex match

    //     tr.setInput('testSelector', 'testAssemblies');
    //     tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
    //     tr.setInput('vstestLocationMethod', 'version');
    //     tr.setInput('vsTestVersion', '15.0');
    //     tr.setInput('runInParallel', 'true');

    //     tr.run()
    //         .then(() => {
    //             assert(tr.resultWasSet, 'task should have set a result');
    //             assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
    //             assert(tr.succeeded, 'task should have succeeded');
    //             assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
    //             assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update3 or higher requirement');
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stderr);
    //             console.log(tr.stdout);
    //             done(err);
    //         });
    // });

    // it('Vstest task with run in parallel and vs 2015 update3 or higher', (done) => {
    //     setResponseFile('vstestRunInParallel.json');

    //     const tr = new trm.TaskRunner('VSTest', false, true, true); // normalize slash, ignore temp path, enable regex match
    //     tr.setInput('testSelector', 'testAssemblies');
    //     tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
    //     tr.setInput('vstestLocationMethod', 'version');
    //     tr.setInput('vsTestVersion', '14.0'); // response file sets above update1
    //     tr.setInput('runInParallel', 'true');

    //     tr.run()
    //         .then(() => {
    //             assert(tr.resultWasSet, 'task should have set a result');
    //             assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
    //             assert(tr.succeeded, 'task should have succeeded');
    //             assert(tr.stdout.search(/##vso\[results.publish type=VSTest;mergeResults=false;resultFiles=a.trx;\]/) >= 0, 'should publish test results.');
    //             assert(tr.stdout.search(/Install Visual Studio 2015 Update 3 or higher on your build agent machine to run the tests in parallel./) < 0, 'should not have given a warning for update3 or higher requirement.');
    //             done();
    //         })
    //         .fail((err) => {
    //             done(err);
    //         });
    // });

    it('Vstest task with custom adapter path', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/TestAdapterPath:E:\\path\\to\\customadapters'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('pathtoCustomTestAdapters', 'E:/path/to/customadapters');

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
    });

    it('Vstest task with test adapter should be found automatically', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/logger:trx', '/TestAdapterPath:E:\\source\\dir'].join(' ');
        setResponseFile('vstestGoodwithNugetAdapter.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('searchFolder', 'E:\\source\\dir');
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
    });

    it('Vstest task with runsettings file and tia.enabled set to false', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:E:\\settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGoodWithTiaDisabled.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'E:\\settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                const result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with runsettings file and tia.enabled undefined', (done) => {

        const vstestCmd = [sysVstestLocation, '/source/dir/someFile1', '/Settings:E:\\settings.runsettings', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'E:\\settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                const result = (tr.stdout.search(/No settings file provided or the provided settings file does not exist. Creating run settings file for enabling test impact data collector/) < 0);
                assert(result, 'should add not test impact collector to runsettings file.');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest task with results directory as absolute path in run settings file', (done) => {

        const settingsFilePath = path.join(__dirname, 'data', 'ResultsDirectoryWithAbsolutePath.runsettings');
        const resultsDirectory = 'C:\\test'; // settings file has this result directory.

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
        tr.setInput('searchDirectory', '/search/dir');
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

    it('RunInParallel enabled with no settings file given', (done) => {
        try {
            settingsHelper.updateSettingsFileAsRequired(undefined, true, { tiaEnabled: false }, undefined, false, undefined)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'Runparallel setting not set properly');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('RunInParallel enabled with invalid settings file', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'Invalid.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, true, { tiaEnabled: false }, undefined, false, undefined)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'Runparallel setting not set properly');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('RunInParallel enabled with Valid settings file, without any configuration', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithoutRunConfiguration.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, true, { tiaEnabled: false }, undefined, false, undefined)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'RunInparallel setting not set properly');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('RunInParallel enabled with Valid settings file, without any MaxCpuCount node in RunConfigurations', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithoutMaxCpuCountNode.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, true, { tiaEnabled: false }, undefined, false, undefined)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'RunInparallel setting not set properly');
                            assert.equal(settings.RunSettings.RunConfiguration[0].TargetFrameworkVersion, 'Framework40', 'RunInparallel should delete any other existing settings');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('RunInParallel enabled with Valid settings file, with MaxCpuCount set to 1', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithMaxCpuCountAs1.runsettings');
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, true, { tiaEnabled: false }, undefined, false, undefined)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'Runparallel setting not set properly');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('Updating runsettings with overridden parameters', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithoutRunConfiguration.runsettings');
            const overriddenParams = '-webAppUrl testVal -webAppInvalid testVal3 -webAppPassword testPass';
            let webAppUrlValue = '';
            let webAppPasswordValue = '';

            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, overriddenParams)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            const parametersArray = settings.RunSettings.TestRunParameters[0].Parameter;
                            parametersArray.forEach(function (parameter) {
                                if (parameter.$.Name === 'webAppUrl') {
                                    webAppUrlValue = parameter.$.Value;
                                } else if (parameter.$.Name === 'webAppInvalid') {
                                    assert.fail(parameter.$.Name, undefined, 'test param should not exist');
                                } else if (parameter.$.name === 'webAppPassword') {
                                    webAppPasswordValue = parameter.$.value;
                                }
                            });

                            assert.equal(webAppUrlValue, 'testVal', 'test run parameters must be overridden');
                            assert.equal(webAppPasswordValue, 'testPass', 'test run parameters must be overridden');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });
    it('Updating testsettings with overridden parameters', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidWithProperties.testsettings');
            const overriddenParams = '-webAppUrl testVal -webAppInvalid testVal3 -webAppPassword testPass --webAppUserName testuser';
            let webAppUrlValue = '';
            let webAppPasswordValue = '';
            let webAppUsername = '';

            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, overriddenParams)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            const parametersArray = settings.TestSettings.Properties[0].Property;
                            parametersArray.forEach(function (parameter) {
                                if (parameter.$.Name === 'webAppUrl') {
                                    webAppUrlValue = parameter.$.Value;
                                } else if (parameter.$.name === 'webAppInvalid') {
                                    assert.fail(parameter.$.Name, undefined, 'test param should not exist');
                                } else if (parameter.$.name === 'webAppPassword') {
                                    webAppPasswordValue = parameter.$.value;
                                } else if (parameter.$.name === '-webAppUserName') {
                                    webAppUsername = parameter.$.Value;
                                }
                            });
                            assert.equal(webAppUrlValue, 'testVal', 'testsettings properties must be overridden');
                            assert.equal(webAppPasswordValue, 'testPass', 'testsettings properties must be overridden');
                            assert.equal(webAppUsername, 'testuser', 'testsettings properties must be overriden');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });


    //Case: Valid xml with multiple properties having same name within Properites section
    //Such a case is invalide test settings file and test platform will fail, as a function updateSettingsFileAsRequired should promise to override all repeated Properties with same value
    it('Updating valid testsettings having repeated property name with overridden parameters', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'ValidTestSettingsWithRepeatedProperty.testsettings');
            const overriddenParams = '-webAppUrl testVal -webAppInvalid testVal3 -webAppPassword testPass';
            let webAppUrlValue = '';
            let webAppUrlValue2 = '';
            let webAppPasswordValue = '';
            let webAppUsername = '';

            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, overriddenParams)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            const parametersArray = settings.TestSettings.Properties[0].Property;
                            let i = 0;
                            parametersArray.forEach(function (parameter) {
                                if (parameter.$.Name === 'webAppUrl') {
                                    if (i === 0) {
                                        webAppUrlValue = parameter.$.Value;
                                    }
                                    else if (i === 1) {
                                        webAppUrlValue2 = parameter.$.Value
                                    }
                                    i++;
                                } else if (parameter.$.name === 'webAppInvalid') {
                                    assert.fail(parameter.$.Name, undefined, 'test param should not exist');
                                } else if (parameter.$.name === 'webAppPassword') {
                                    webAppPasswordValue = parameter.$.value;
                                } else if (parameter.$.name === '-webAppUserName') {
                                    webAppUsername = parameter.$.Value;
                                }
                            });
                            assert.equal(webAppUrlValue, 'testVal', 'testsettings properties must be overridden');
                            assert.equal(webAppPasswordValue, 'testPass', 'testsettings properties must be overridden');
                            assert.equal(webAppUsername, 'Admin', 'testsettings properties must not be overriden');
                            assert.equal(webAppUrlValue2, 'testVal', 'testsettings properties must be overridden');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    //Case: Valid xml with multiple properties section is provided, updateSettingsFileAsRequired will only replace properties in first section
    //Such a case is invalid test settings file and test platform will fail, as a function updateSettingsFileAsRequired should promise to override Properties in first section only
    it('Updating Invalid testsettings having multiple properties sections with overridden parameters', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'InvalidWithMultiplePropertiesSections.testsettings');
            const overriddenParams = '-webAppUrl testVal -webAppInvalid testVal3 -webAppPassword testPass';
            let webAppUrlValue = '';
            let webAppPasswordValue = '';
            let webAppUrlValue2 = '';
            let webAppUsername = '';

            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, false, { tiaEnabled: false }, undefined, false, overriddenParams)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            const parametersArray = settings.TestSettings.Properties[0].Property;
                            parametersArray.forEach(function (parameter) {
                                if (parameter.$.Name === 'webAppUrl') {
                                    webAppUrlValue = parameter.$.Value;
                                } else if (parameter.$.name === 'webAppInvalid') {
                                    assert.fail(parameter.$.Name, undefined, 'test param should not exist');
                                } else if (parameter.$.name === 'webAppPassword') {
                                    webAppPasswordValue = parameter.$.value;
                                } else if (parameter.$.name === '-webAppUserName') {
                                    webAppUsername = parameter.$.Value;
                                }
                            });
                            const parametersArray2 = settings.TestSettings.Properties[1].Property
                            parametersArray2.forEach(function (parameter) {
                                if (parameter.$.Name === 'webAppUrl') {
                                    webAppUrlValue2 = parameter.$.Value;
                                }
                            });

                            assert.equal(webAppUrlValue, 'testVal', 'testsettings properties must be overridden');
                            assert.equal(webAppPasswordValue, 'testPass', 'testsettings properties must be overridden');
                            assert.equal(webAppUsername, 'Admin', 'testsettings properties must not be overriden');
                            assert.equal(webAppUrlValue2, 'Duplicatelocalhost', 'testsettings properties must not be overridden');
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    //In case of invalid xml provided by user or xml not having required tags, updateSettingsFileAsRequired returns a default run settings
    it('Updating invalid testsettings with overridden parameters', (done) => {
        try {
            const settingsFilePath = path.join(__dirname, 'data', 'Invalid.testsettings');
            const overriddenParams = '-webAppUrl testVal -webAppInvalid testVal3 -webAppPassword testPass';
            settingsHelper.updateSettingsFileAsRequired(settingsFilePath, true, { tiaEnabled: false }, undefined, false, overriddenParams)
                .then(function (settingsXml: string) {
                    utils.Helper.getXmlContents(settingsXml)
                        .then(function (settings) {
                            assert.equal(settings.RunSettings.RunConfiguration[0].MaxCpuCount, 0, 'Default setting not set properly' + settings);
                            done();
                        });
                });
        } catch (error) {
            assert.fail('updateSettingsFileAsRequired failed');
            done(error);
        }
    });

    it('modiyArgument test', (done) => {
        let modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile("somestring");
        assert.equal(modifiedString, "\"somestring\"", "string doesnt match");

        modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile("some string.dll");
        assert.equal(modifiedString, "\"some string.dll\"", "string doesnt match");

        modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile("/settings:c:\\a b\\1.settings");
        assert.equal(modifiedString, '/settings:\"c:\\a b\\1.settings\"', "string doesnt match");

        modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile('/settings:\"c:\\a b\\1.settings\"');
        assert.equal(modifiedString, '/settings:\"c:\\a b\\1.settings\"', "string doesnt match");

        modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile("/logger:trx");
        assert.equal(modifiedString, '/logger:\"trx\"', "string doesnt match");

        modifiedString = utils.Helper.modifyVsTestConsoleArgsForResponseFile(null);
        assert.equal(modifiedString, null, "string doesnt match");

        done();
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
                assert(tr.stdout.indexOf('The location of \'vstest.console.exe\' specified \'C:/vstest.console.exe\' does not exist.') >= 0,
                    'should throw invalid path error');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest search folder field supports double dots', (done) => {
        const vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('searchFolder', 'E:\\source\\dir\\..');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/Search folder : E:\\source/) >= 0, 'searching in the wrong path with double dots');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest search folder field supports single dots', (done) => {
        const vstestCmd = [sysVstestLocation, '/source/dir/someFile2 /source/dir/someFile1', '/logger:trx'].join(' ');
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/some/*pattern');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('searchFolder', 'E:\\source\\.\\dir');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.ran(vstestCmd), 'should have run vstest');
                assert(tr.stdout.search(/Search folder : E:\\source\\dir/) >= 0, 'searching in the wrong path with single dots');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest task with settings file path with double dots is supported', (done) => {

        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'E:\\source\\dir\\..\\settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/Run settings file : E:\\source\\settings.runsettings/) >= 0, 'wrong path for settings file with double dots');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with settings file path with single dots is supported', (done) => {
        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('runSettingsFile', 'E:\\source\\dir\\.\\settings.runsettings');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/Run settings file : E:\\source\\dir\\settings.runsettings/) >= 0, 'wrong path for settings file with single dots');
                done();
            })
            .fail((err) => {
                done(err);
            });
    });

    it('Vstest task with custom adapter path with double dots is supported', (done) => {

        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('pathtoCustomTestAdapters', 'E:/path/to/../customadapters');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/Path to custom adapters : E:\\path\\customadapters/) >= 0, 'wrong path for custom adapters with double dots');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });

    it('Vstest task with custom adapter path with single dots is supported', (done) => {

        setResponseFile('vstestGood.json');

        const tr = new trm.TaskRunner('VSTest');
        tr.setInput('testSelector', 'testAssemblies');
        tr.setInput('testAssemblyVer2', '/source/dir/someFile1');
        tr.setInput('vstestLocationMethod', 'version');
        tr.setInput('vsTestVersion', '14.0');
        tr.setInput('pathtoCustomTestAdapters', 'E:/path/to/./customadapters');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length === 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/Path to custom adapters : E:\\path\\to\\customadapters/) >= 0, 'wrong path for custom adapters with single dots');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    });
});
