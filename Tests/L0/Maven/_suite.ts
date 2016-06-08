/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import fs = require('fs');

import tr = require('../../lib/vsts-task-lib/toolRunner');

import pmd = require('../../../Tasks/Maven/CodeAnalysis/mavenpmd');
import ca = require('../../../Tasks/Maven/CodeAnalysis/mavencodeanalysis');
import ar = require('../../../Tasks/Maven/CodeAnalysis/analysisResult');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

// Sets up a Maven TaskRunner instance with all of the required default settings
function setupDefaultMavenTaskRunner():trm.TaskRunner {
    var taskRunner = new trm.TaskRunner('Maven', true, true);
    // default required settings
    taskRunner.setInput('mavenVersionSelection', 'Path');
    taskRunner.setInput('mavenPath', '/home/bin/maven') // Make that checkPath returns true for this filename in the response file
    taskRunner.setInput('goals', 'package');
    taskRunner.setInput('javaHomeSelection', 'JDKVersion');
    taskRunner.setInput('jdkVersion', 'default');
    taskRunner.setInput('jdkArchitecture', 'x86');
    taskRunner.setInput('testResultsFiles', '**/TEST-*.xml');
    taskRunner.setInput('sqAnalysisEnabled', 'false');
    taskRunner.setInput('mavenPOMFile', 'pom.xml');

    return taskRunner;
}

// Recursively lists all files within the target folder, giving their full paths.
function listFolderContents(folder):string[] {
    var result:string[] = [];
    var filesInFolder = fs.readdirSync(folder);

    filesInFolder.forEach(function (fileInFolder) {
        result.push(path.join(folder, fileInFolder));
        if (fs.statSync(path.join(folder, fileInFolder)).isDirectory()) {
            result = result.concat(listFolderContents(path.join(folder, fileInFolder)));
        }
    });

    return result;
}

// Adds mock exist, checkPath, rmRF and mkdirP responses for given file paths.
// Takes an object to add to and an array of file paths for which responses should be added.
// Modifies and returns the argument object.
function setupMockResponsesForPaths(responseObject:any, paths: string[]) { // Can't use rest arguments here (gulp-mocha complains)

    // Create empty objects for responses only if they did not already exist (avoid overwriting existing responses)
    responseObject.exist = responseObject.exist || {};
    responseObject.checkPath = responseObject.checkPath || {};
    responseObject.rmRF = responseObject.rmRF || {};
    responseObject.mkdirP = responseObject.mkdirP || {};

    var rmRFSuccessObj = {
        success: true,
        message: "foo bar"
    };


    paths.forEach((path) => {
        responseObject.exist[path] = true;
        responseObject.checkPath[path] = true;
        responseObject.rmRF[path] = rmRFSuccessObj;
        responseObject.mkdirP[path] = true;
    });

    return responseObject;
}

// Create temp dirs for mavencodeanalysis tests to save into
function createTempDirsForCodeAnalysisTests():void {
    var testTempDir:string = path.join(__dirname, '_temp');
    var caTempDir:string = path.join(testTempDir, '.codeAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);

        if (!fs.existsSync(caTempDir)) {
            fs.mkdirSync(caTempDir);
        }
    }
}

// Asserts the existence of a given line in the build summary file that is uploaded to the server.
function assertBuildSummaryContainsLine(stagingDir:string, expectedLine:string):void {
    var buildSummaryFilePath:string = path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md');
    var buildSummaryString:string = fs.readFileSync(buildSummaryFilePath, 'utf-8');

    assert(buildSummaryString.indexOf(expectedLine) > -1, "Expected build summary to contain: " + expectedLine);
}

// Creates a new response json file based on an initial one and some env variables 
function setResponseAndBuildVars(initialResponseFile:string, finalResponseFile:string, envVars: Array<[string,string]> ) {

    var responseJsonFilePath: string = path.join(__dirname, initialResponseFile);
    var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
    for (var envVar of envVars)
    {
        responseJsonContent.getVariable[envVar[0]]= envVar[1];
    }

    var newResponseFilePath: string = path.join(__dirname, finalResponseFile);
    fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
    setResponseFile(path.basename(newResponseFilePath));
}

describe('Maven Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

    });

    it('run maven with all default inputs and M2_HOME not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with all default inputs and M2_HOME set', (done) => {
        setResponseFile('responseM2_HOME.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        process.env['M2_HOME'] = '/anotherHome/bin/maven/bin/mvn';

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        //tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenVersionSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with INVALID mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath valid)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath missing)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenPath') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath INVALID)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven333')
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found mavenPath:') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to garbage', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to true', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'true');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set M2_HOME=/home/bin/maven2') >= 0, 'M2_HOME not set');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with options set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p "/t:i o" /n /s');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t:i o /n /s package'), 'it should have run mvn -f pom.xml /o /p /t:i o /n /s package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with goals not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        //tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: goals') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with tasks set to multiple', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing publishJUnitResults input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with publishJUnitResults set to "garbage"', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven and publish tests', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('##vso[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=/user/build/fun/test-123.xml;]') >= 0, 'test files not published');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
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

    it('fails if missing javaHomeSelection input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        //tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
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

    it('run maven with jdkVersion set to 1.8', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set JAVA_HOME=/user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with jdkVersion set to 1.5', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
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

    it('run maven with Valid inputs but it fails', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'FAIL package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml FAIL package'), 'it should have run mvn -f pom.xml FAIL package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('FAILED') >= 0, 'It should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven including SonarQube analysis', (done) => {
       
       // not a valid PR branch
       setResponseAndBuildVars(
            'response.json',
            'new_response.json',
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"]])

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven including SonarQube analysis (with db details)', (done) => {

       // not a valid PR branch 
       setResponseAndBuildVars(
            'response.json',
            'new_response.json',
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "ExternalGit"]])

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqDbDetailsRequired', 'true');
        tr.setInput('sqDbUrl', 'dbURL');
        tr.setInput('sqDbUsername', 'dbUser');
        tr.setInput('sqDbPassword', 'dbPass');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=dbURL -Dsonar.jdbc.username=dbUser -Dsonar.jdbc.password=dbPass -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('maven calls enable code coverage and publish code coverage when jacoco is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage , publish code coverage and sonar analysis when jacoco  and sonar analysis is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jacoco.reportPath=CCReport43F6D5EF\/jacoco.exec -f pom.xml sonar:sonar'), 'it should have run SQ analysis');               
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 4, 'should have only run maven 4 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when jacoco is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })


    it('maven calls enable code coverage and publish code coverage when cobertura is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage , publish code coverage and sonar analysis when cobertura is selected and sonar analysis enabled', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when cobertura is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })
    
    it('Maven build with publish test results', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'None');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('Maven with PMD - Executes PMD and uploads results when there is only a root module', function(done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir:string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir:string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir:string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        var pmdStgDir:string = path.join(codeAnalysisStgDir, '.pmd'); // PMD subdir is used for artifact staging
        var moduleStgDir:string = path.join(pmdStgDir, 'root'); // one and only one module in test data, called root

        var responseJsonFilePath:string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath:string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner:trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.succeeded, 'task should have succeeded');

                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');

                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=root;artifactname=') > -1,
                    'should have uploaded PMD build artifacts');

                assertBuildSummaryContainsLine(testStgDir, 'PMD found 3 violations in 2 files.');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Executes PMD and uploads results when multiple modules are present', function(done) {
        // In the test data:
        // /: pom.xml, no target/
        // /util/: pom.xml, target/, has violations
        // /ignored/: pom.xml, no target/
        // /backend/: pom.xml, target/, has no violations - not expecting uploads from this module
        // /leveltwo/app/: pom.xml, target/, has violations
        // /leveltwo/static/: no pom.xml, target/

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir:string = path.join(__dirname, 'data', 'multimodule');
        var testStgDir:string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir:string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        var pmdStgDir:string = path.join(codeAnalysisStgDir, '.pmd'); // PMD subdir is used for artifact staging

        var responseJsonFilePath:string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath:string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner:trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {

                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.succeeded, 'task should have succeeded');

                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');

                // assert artifacts not uploaded
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=app;artifactname=') > -1,
                    'should have uploaded PMD build artifacts for the "app" module');
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=util;artifactname=') > -1,
                    'should have uploaded PMD build artifacts for the "util" module');
                assert(taskRunner.stdout.indexOf('artifact.upload containerfolder=backend;artifactname=') < 0,
                    'should not have uploaded PMD build artifacts for the "backend" module');

                assertBuildSummaryContainsLine(testStgDir, 'PMD found 6 violations in 4 files.');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Skips PMD goals if PMD is not enabled', function(done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir:string = path.join(__dirname, '_temp');
        var testSrcDir:string = path.join(__dirname, 'data');

        var responseJsonFilePath:string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        // Write and set the newly-changed response file
        var newResponseFilePath:string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner:trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'false');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.succeeded, 'task should have succeeded');

                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package'),
                    'should have run maven without PMD arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') < 1,
                    'should not have uploaded a Code Analysis Report build summary');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Should succeed even if XML output cannot be found', function(done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir:string = path.join(__dirname, '_temp');
        var testSrcDir:string = path.join(__dirname, 'data');

        // Add test file(s) to the response file so that tl.exist() and tl.checkPath() calls return correctly
        var testXmlFilePath = path.join(testSrcDir, 'target', 'pmd.xml');
        var testHtmlFilePath = path.join(testSrcDir, 'target', 'site', 'pmd.html');
        var srcResponseFilePath:string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(srcResponseFilePath, 'utf-8'));

        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        responseJsonContent = setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;
        responseJsonContent.getVariable['build.buildNumber'] = '1';

        var newResponseFilePath:string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        // Set the newly-changed response file
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner:trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                //console.log(taskRunner.stdout);

                // Assert
                assert(taskRunner.succeeded, 'task should not have failed');
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');

                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('during PR builds SonarQube analysis runs in issues mode', (done) => {

       setResponseAndBuildVars(
            'response.json',
            'new_response.json',
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"]])

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        
        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -f pom.xml -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json sonar:sonar'), 'it should have run SQ analysis in issues mode');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })   
});