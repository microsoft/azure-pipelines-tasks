/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('ANT Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

    });

    it('run ANT with all inputs', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
                assert(tr.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
                assert(tr.invokedToolCount == 2, 'should have only run ANT 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing antBuildFile input', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run ANT');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: antBuildFile') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing javaHomeSelection input', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run ANT');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: javaHomeSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run ANT');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: testResultsFiles') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run ANT with antHomeUserInputPath', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('antHomeUserInputPath', '/usr/local/bin/ANT2'); // Make that checkPath returns true for this filename in the response file
		
        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
                assert(tr.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
                assert(tr.invokedToolCount == 2, 'should have only run ANT 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('Set ANT_HOME to /usr/local/bin/ANT2') >= 0, 'ANT_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run ANT with antHomeUserInputPath set to invalid path', (done) => {
        setResponseFile('antVersionFails.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('antHomeUserInputPath', '/usr/local/bin/ANT_invalid');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run ANT');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found antHomeUserInputPath: /usr/local/bin/ANT_invalid') >= 0, 'Invalid path not detected');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run ANT with ANT_HOME not set', (done) => {
        setResponseFile('antVersionFails.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
                assert(tr.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
                assert(tr.invokedToolCount == 1, 'should have only run ANT 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('The ANT_HOME environment variable is not set') >= 0, 'Missing JAVA_HOME not detected');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run ANT with jdkVersion set to 1.8', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
                assert(tr.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
                assert(tr.invokedToolCount == 2, 'should have only run ANT 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('Set JAVA_HOME to /user/local/bin/ANT8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run ANT with jdkVersion set to 1.5', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run ANT');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('Failed to find specified JDK version') >= 0, 'JAVA_HOME set?');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })	
	
    // JDKVersion set to path
	
	
    it('run ANT valid inputs but it fails', (done) => {
        setResponseFile('antFails.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
                assert(tr.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
                assert(tr.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
                assert(tr.invokedToolCount == 2, 'should have only run ANT 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Ant fails when code coverage tool is Jacoco but no class files directory input is provided.', (done) => {
        setResponseFile('antCodeCoverage.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Ant fails when code coverage tool is Cobertura but no class files directory input is provided.', (done) => {
        setResponseFile('antCodeCoverage.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'Cobertura');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Ant calls enable code coverage and publish code coverage when Cobertura is selected.', (done) => {
        setResponseFile('antCodeCoverage.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('classFilesDirectories', 'class1');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\\build\\CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\\build\\CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=Cobertura;\]/) >= 0 || tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\/build\/CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\/build\/CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\\build\\CCReport43F6D5EF\\coverage.xml;reportdirectory=\\build\\CCReport43F6D5EF;\]/) >= 0 ||
                    tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/build\/CCReport43F6D5EF\/coverage.xml;reportdirectory=\/build\/CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                done();
            })
            .fail((err) => {
                assert.fail("task should not have failed");
                done(err);
            });
    })

    it('Ant calls enable code coverage and publish code coverage when Jacoco is selected.', (done) => {
        setResponseFile('antCodeCoverage.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('classFilesDirectories', 'class1');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\\build\\CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\\build\\CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=JaCoCo;\]/) >= 0 || tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\/build\/CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\/build\/CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\\build\\CCReport43F6D5EF\\coverage.xml;reportdirectory=\\build\\CCReport43F6D5EF;\]/) >= 0 ||
                    tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/build\/CCReport43F6D5EF\/coverage.xml;reportdirectory=\/build\/CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                done();
            })
            .fail((err) => {
                assert.fail("task should not have failed");
                done(err);
            });
    })

    it('Ant calls enable code coverage but not publish code coverage when summary file is not generated.', (done) => {
        setResponseFile('antGood.json');
        // antGood.json doesnt mock the stat for summary file.
        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('classFilesDirectories', 'class1');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\\build\\CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\\build\\CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=JaCoCo;\]/) >= 0 || tr.stdout.search(/##vso\[codecoverage.enable buildfile=\/build\/build.xml;classfilesdirectories=class1;summaryfile=coverage.xml;reportdirectory=\/build\/CCReport43F6D5EF;ccreporttask=CodeCoverage_9064e1d0;reportbuildfile=\/build\/CCReportBuildA4D283EG.xml;buildtool=Ant;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish/) < 0, 'should have called publish code coverage.');
                done();
            })
            .fail((err) => {
                assert.fail("task should not have failed");
                done(err);
            });
    })

    it('Ant build with Publish Test Results.', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('codeCoverageTool', 'None');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                done();
            })
            .fail((err) => {
                assert.fail("task should not have failed");
                done(err);
            });
    })

    it('Ant build with Publish Test Results with no matching test result files.', (done) => {
        setResponseFile('antGood.json');

        var tr = new trm.TaskRunner('Ant');
        tr.setInput('antBuildFile', '/build/build.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/InvalidTestFilter-*.xml');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('codeCoverageTool', 'None');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish\]/) < 0, 'publish test results should not have got called.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');                
                assert(tr.stdout.search(/##vso\[task.issue type=warning;\]No test result files matching/) >= 0, 'should have produced warning.');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("task should not have failed");
                done(err);
            });
    })
});