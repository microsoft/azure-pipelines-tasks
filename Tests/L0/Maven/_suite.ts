/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import mockHelper = require('../../lib/mockHelper');
import path = require('path');
import fs = require('fs');
import url = require('url');
import {Url} from 'url';
import shell = require('shelljs');

import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tr = require('../../lib/vsts-task-lib/toolRunner');
import tl = require('../../lib/vsts-task-lib/toolRunner');

import sqCommon = require('../../../Tasks/Maven/CodeAnalysis/SonarQube/common');
import {VstsServerUtils} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/vsts-server-utils';
import {SonarQubeRunSettings} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/run-settings';
import {ISonarQubeServer} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/server';
import {SonarQubeEndpoint} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/endpoint';
import {SonarQubeReportBuilder} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/report-builder';
import {SonarQubeMetrics} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/metrics';
import {SonarQubeMeasurementUnit} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/metrics';
import {MockSonarQubeServer} from './server-mock';

import {FileSystemInteractions} from '../../../Tasks/Maven/CodeAnalysis/Common/FileSystemInteractions';

import http = require('http');
import {IncomingMessage} from 'http';

import os = require('os');

var isWindows = os.type().match(/^Win/); 

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

// Sets up a Maven TaskRunner instance with all of the required default settings
function setupDefaultMavenTaskRunner(): trm.TaskRunner {
    var taskRunner = new trm.TaskRunner('Maven', true, true);
    // default required settings
    taskRunner.setInput('mavenVersionSelection', 'Path');
    taskRunner.setInput('mavenPath', '/home/bin/maven'); // Make that checkPath returns true for this filename in the response file
    taskRunner.setInput('goals', 'package');
    taskRunner.setInput('javaHomeSelection', 'JDKVersion');
    taskRunner.setInput('jdkVersion', 'default');
    taskRunner.setInput('jdkArchitecture', 'x86');
    taskRunner.setInput('testResultsFiles', '**/TEST-*.xml');
    taskRunner.setInput('sqAnalysisEnabled', 'false');
    taskRunner.setInput('mavenPOMFile', 'pom.xml');

    // TaskRunner system is incompatible with HTTP/HTTPS mocking due to the use of seperate processes
    taskRunner.setInput('sqAnalysisIncludeFullReport', 'false');

    return taskRunner;
}

// Recursively lists all files within the target folder, giving their full paths.
function listFolderContents(folder): string[] {
    var result: string[] = [];
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
function setupMockResponsesForPaths(responseObject: any, paths: string[]) { // Can't use rest arguments here (gulp-mocha complains)

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
function createTempDirsForCodeAnalysisTests(): void {
    var caTempDir: string = path.join(createTempDir(), '.codeAnalysis');

    if (!fs.existsSync(caTempDir)) {
        fs.mkdirSync(caTempDir);
    }
}

// Create temp dirs for mavencodeanalysis tests to save into
function createTempDirsForSonarQubeTests(): void {
    var sqTempDir: string = path.join(createTempDir(), '.sqAnalysis');

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

function createTempDir():string {
    var testTempDir: string = path.join(__dirname, '_temp');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    return testTempDir;
}

function captureStream(stream):{unhook():void, captured():string} {
    var oldWrite = stream.write;
    var buf:string = '';
    stream.write = function(chunk, encoding, callback) {
        buf += chunk.toString(); // chunk is a String or Buffer
        oldWrite.apply(stream, arguments);
    };

    return {
        unhook: function unhook():void {
            stream.write = oldWrite;
        },
        captured: function():string {
            return buf;
        }
    };
}

function cleanTempDirsForCodeAnalysisTests():void {
    var testTempDir: string = path.join(__dirname, '_temp');
    deleteFolderRecursive(testTempDir);
}

function deleteFolderRecursive(path):void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

function assertCodeAnalysisBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(fs.readFileSync(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), 'utf-8'), expectedString);
}

function assertCodeAnalysisBuildSummaryDoesNotContain(stagingDir: string, unexpectedString: string): void {
    assertBuildSummaryDoesNotContain(fs.readFileSync(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), 'utf-8'), unexpectedString);
}

function assertSonarQubeBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(fs.readFileSync(path.join(stagingDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), 'utf-8'), expectedString);
}

// Asserts the existence of a given line in the build summary file that is uploaded to the server.
function assertBuildSummaryContains(buildSummaryString: string, expectedLine: string): void {
    assert(buildSummaryString.indexOf(expectedLine) > -1, `Expected build summary to contain: ${expectedLine}
     Actual: ${buildSummaryString}`);
}

// Asserts the existence of a given line in the build summary file that is uploaded to the server.
function assertBuildSummaryDoesNotContain(buildSummaryString: string, string: string): void {
    assert(buildSummaryString.indexOf(string) === -1, `Expected build summary to not contain: ${string}
     Actual: ${buildSummaryString}`);
}

function assertFileExistsInDir(stagingDir:string, filePath:string) {
    var directoryName:string = path.dirname(path.join(stagingDir, filePath));
    var fileName:string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    var directoryContents:string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) > -1, `Expected file did not exist: ${filePath}
    Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertFileDoesNotExistInDir(stagingDir:string, filePath:string) {
    var directoryName:string = path.dirname(path.join(stagingDir, filePath));
    var fileName:string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    var directoryContents:string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) === -1, `Expected file to not exist, but it does: ${filePath}
    Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertErrorContains(error: any, expectedString: string): void {
    assert(error instanceof Error, `Expected an instance of Error to be thrown. Actual: ${typeof error}`);
    assert(error.message.indexOf(expectedString) > -1, `Expected error to contain: ${expectedString}
     Actual: ${error.message}`);
}

function assertStringContains(actualString:string, expectedString:string):void {
    assert(actualString.indexOf(expectedString) > -1, `Expected string to contain: ${expectedString}`);
}


function assertToolRunnerContainsArg(toolRunner:ToolRunner, expectedArg:string) {
    return toolRunner.args.indexOf(expectedArg) > -1;
}

function assertToolRunnerHasArgLength(toolRunner: ToolRunner, expectedNumArgs: number) {
    return toolRunner.args.length == expectedNumArgs;
}

describe('Maven Suite', function () {
    this.timeout(20000);

    before((done) => {
        Q.longStackSupport = true;
        done();
    });

    after(function () {
    });

    it('run maven with all default inputs and M2_HOME not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('Maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenOpts', '-Xmx2048m');

        tr.setInput('checkstyleAnalysisEnabled', 'false');
        tr.setInput('pmdAnalysisEnabled', 'false');
        tr.setInput('findbugsAnalysisEnabled', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('MAVEN_OPTS is now set to -Xmx2048m') > 0);

                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'),
                    'should have run maven without Checkstyle arguments');
                assert(tr.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') < 0,
                    'should not have uploaded a Code Analysis Report build summary');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                done(err);
            });
    })

    it('run maven with all default inputs and M2_HOME set', (done) => {
        setResponseFile('responseM2_HOME.json');

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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
        var tr = new trm.TaskRunner('Maven', true);
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
        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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

        var tr = new trm.TaskRunner('Maven', true);
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
                if (isWindows) {
                    assert(tr.invokedToolCount == 1, 'should not have run maven'); // Should have run reg query toolrunner once
                } else {
                    assert(tr.invokedToolCount == 0, 'should not have run maven');
                }
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

        var tr = new trm.TaskRunner('Maven', true);
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

    it('run maven including SonarQube analysis', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    '[Detailed SonarQube report >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })

    it('run maven including SonarQube analysis (with db details)', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr = new trm.TaskRunner('Maven', true);
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
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=dbURL -Dsonar.jdbc.username=dbUser -Dsonar.jdbc.password=dbPass sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    '[Detailed SonarQube report >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })

    it('Maven with SonarQube - Fails when report-task.txt is invalid', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-invalid');
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should not have succeeded');
                
                // there are 2 report-task.txt files found, so a warning should be generated
                assert(tr.stdout.indexOf('vso[task.issue type=warning;]Multiple report-task.txt files found.')> -1);
                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 1,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                assert(tr.stderr.indexOf('Invalid or missing task report. Check SonarQube finished successfully.') > -1,
                    'should have output an error about a failure to find the task report');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with SonarQube - Warns when report-task.txt is missing', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
       var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule'); // no report-task.txt here
        var testStgDir: string = path.join(__dirname, '_temp');

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 0,
                    'should not have uploaded a SonarQube Analysis Report build summary');

                assert(tr.stdout.indexOf('vso[task.issue type=warning;]Could not find report-task.txt')> -1, 
                    'Should have fired a warning about the missing report-task.txt');

                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with SonarQube - Does not fail if report-task.txt is missing during a PR build', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = __dirname;
        var testStgDir: string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        createTempDirsForCodeAnalysisTests();

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran(
                    '/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json sonar:sonar'
                ), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length < 1, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 1,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven build with publish test results', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('Maven', true);
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

    it('Maven with PMD - Executes PMD and uploads results', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis'); // overall directory for all tools
        var pmdStgDir: string = path.join(codeAnalysisStgDir, '.pmd'); // PMD subdir is used for artifact staging
        var moduleStgDir: string = path.join(pmdStgDir, 'root'); // one and only one module in test data, called root

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 3 violations in 2 files.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for root module, build 1
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Maven with PMD - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir: string = path.join(__dirname, '_temp');
        var testSrcDir: string = path.join(__dirname, 'data');

        // Add test file(s) to the response file so that tl.exist() and tl.checkPath() calls return correctly
        var srcResponseFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(srcResponseFilePath, 'utf-8'));

        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        // Set the newly-changed response file
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('pmdAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.succeeded, 'task should not have failed');
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
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

    it('Maven with Checkstyle - Executes Checkstyle and uploads results', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('checkstyleAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package checkstyle:checkstyle'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 9 violations in 2 files.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for root module, build 1
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_checkstyle_Checkstyle.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Maven with Checkstyle - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir: string = path.join(__dirname, '_temp');
        var testSrcDir: string = path.join(__dirname, 'data');

        // Add test file(s) to the response file so that tl.exist() and tl.checkPath() calls return correctly
        var srcResponseFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(srcResponseFilePath, 'utf-8'));

        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        // Set the newly-changed response file
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('checkstyleAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.succeeded, 'task should not have failed');
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package checkstyle:checkstyle'),
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

    it('Maven with FindBugs - Executes FindBugs and uploads results', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('findbugsAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package findbugs:findbugs'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found 5 violations in 1 file.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for root module, build 1
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_findbugs_FindBugs.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Maven with FindBugs - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testStgDir: string = path.join(__dirname, '_temp');
        var testSrcDir: string = path.join(__dirname, 'data');

        // Add test file(s) to the response file so that tl.exist() and tl.checkPath() calls return correctly
        var srcResponseFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(srcResponseFilePath, 'utf-8'));

        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));

        // Set the newly-changed response file
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('findbugsAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.succeeded, 'task should not have failed');
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package findbugs:findbugs'),
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

    it('Maven with code analysis - Uploads results for tools when report files are present, even if those tools are not enabled', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('checkstyleAnalysisEnabled', 'true');
        taskRunner.setInput('pmdAnalysisEnabled', 'true');
        taskRunner.setInput('findbugsAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package checkstyle:checkstyle findbugs:findbugs pmd:pmd'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 9 violations in 2 files.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 3 violations in 2 files.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found 5 violations in 1 file.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for root module, build 1
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_checkstyle_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_findbugs_FindBugs.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Maven with code analysis - Only shows empty results for tools which are enabled', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule-noviolations');
        var testStgDir: string = path.join(__dirname, '_temp');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('checkstyleAnalysisEnabled', 'false');
        taskRunner.setInput('pmdAnalysisEnabled', 'false');
        taskRunner.setInput('findbugsAnalysisEnabled', 'true');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package findbugs:findbugs'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'Checkstyle found no violations.');
                assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'PMD found no violations.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found no violations.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // No files should have been copied since they all report no violations
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'root/1_checkstyle_Checkstyle.xml');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'root/1_findbugs_FindBugs.xml');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.html');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Maven with code analysis - Executes and uploads results for all enabled tools', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        createTempDirsForCodeAnalysisTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        var responseJsonFilePath: string = path.join(__dirname, 'response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Set mocked build variables
        responseJsonContent.getVariable = responseJsonContent.getVariable || {};
        responseJsonContent.getVariable['build.sourcesDirectory'] = testSrcDir;
        responseJsonContent.getVariable['build.artifactStagingDirectory'] = testStgDir;

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        // Set up the task runner with the test settings
        var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
        taskRunner.setInput('checkstyleAnalysisEnabled', 'false');
        taskRunner.setInput('pmdAnalysisEnabled', 'false');
        taskRunner.setInput('findbugsAnalysisEnabled', 'false');

        // Act
        taskRunner.run()
            .then(() => {
                // Assert
                assert(taskRunner.resultWasSet, 'should have set a result');
                assert(taskRunner.stdout.length > 0, 'should have written to stdout');
                assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
                assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(taskRunner.succeeded, 'task should have succeeded');
                assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package'),
                    'should have run maven with the correct arguments');
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') > -1,
                    'should have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 9 violations in 2 files.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 3 violations in 2 files.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found 5 violations in 1 file.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for root module, build 1
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_checkstyle_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_findbugs_FindBugs.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_pmd_PMD.xml');

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('during PR builds SonarQube analysis runs in issues mode', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, 'new_response.json');
        var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

        // Add fields corresponding to responses for mock filesystem operations for the following paths
        // Staging directories
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testStgDir));
        // Test data files
        responseJsonContent = mockHelper.setupMockResponsesForPaths(responseJsonContent, listFolderContents(testSrcDir));

        // Write and set the newly-changed response file
        var newResponseFilePath: string = path.join(__dirname, this.test.title + '_response.json');
        fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
        setResponseFile(path.basename(newResponseFilePath));

        var tr: trm.TaskRunner = setupDefaultMavenTaskRunner();
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package -Dsonar.host.url=http://sonarqubeserver:9000 -Dsonar.login=uname -Dsonar.password=pword -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json sonar:sonar'), 'it should have run SQ analysis in issues mode');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    })

    /* SonarQube unit tests */

    it('SonarQube common - task and analysis details caching holds true over multiple requests, and does not invoke additional REST calls', () => {
        // Arrange
        var mockRunSettings:SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer:MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics:SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder:SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'OK'; // Quality gate passed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        return analysisMetrics.fetchQualityGateStatus()
            .then((qualityGateStatus:string) => {
                var expectedQualityGateStatus:string = qualityGateStatus;
                var oldInvokeCount = mockServer.responses.get('/api/qualitygates/project_status?analysisId=12345').invokedCount;

                assert(oldInvokeCount == 1, 'Expected the analysis details endpoint to only have been invoked once');
                return analysisMetrics.fetchQualityGateStatus()
                    .then((qualityGateStatus:string) => {
                        var actualQualityGateStatus:string = qualityGateStatus;
                        var newInvokeCount = mockServer.responses.get('/api/qualitygates/project_status?analysisId=12345').invokedCount;

                        assert(expectedQualityGateStatus === actualQualityGateStatus, 'Expected the new analysis details to strictly equal the old analysis details');
                        assert(oldInvokeCount == newInvokeCount, 'Expected no further invocations of the analysis details endpoint');
                    });
            })
    });

    it('SonarQube common - measurement details caching holds true over multiple requests, and does not invoke additional REST calls', () => {
        // Arrange
        var mockRunSettings:SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer:MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics:SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout

        // Mock responses from the server for the measurement details
        var measurementDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/measurement_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/metrics/search?ps=500&f=name', measurementDetailsJsonObject);

        // Act
        // Make a few requests
        var measurementDetailsResults:SonarQubeMeasurementUnit[][] = [];
        return analysisMetrics.fetchMeasurementDetails()
            .then((measurementDetailsResult:SonarQubeMeasurementUnit[]) => {
                measurementDetailsResults.push(measurementDetailsResult);
                return analysisMetrics.fetchMeasurementDetails();
            })
            .then((measurementDetailsResult:SonarQubeMeasurementUnit[]) => {
                measurementDetailsResults.push(measurementDetailsResult);
                return analysisMetrics.fetchMeasurementDetails();
            })
            .then((measurementDetailsResult:SonarQubeMeasurementUnit[]) => {
                measurementDetailsResults.push(measurementDetailsResult);
                var expectedMeasurementDetails:SonarQubeMeasurementUnit[] = measurementDetailsJsonObject.metrics as SonarQubeMeasurementUnit[];

                measurementDetailsResults.forEach((actualMeasurementDetails:SonarQubeMeasurementUnit[]) => {
                    // All results should match the expected
                    var expectedLength = expectedMeasurementDetails.length;
                    var actualLength = actualMeasurementDetails.length;
                    assert(expectedLength == actualLength, `Returned measurement details length (${actualLength}) should match the original (${expectedLength})`);
                    assert(expectedMeasurementDetails.every( (v,i) => {
                        return v === actualMeasurementDetails[i];
                    }), 'Each element of the returned measurement details should match the original');

                    // Endpoint should only have been invoked once
                    var invokeCount = mockServer.responses.get('/api/metrics/search?ps=500&f=name').invokedCount;
                    assert(invokeCount == 1, `Measurement details endpoint should only have been invoked once. Actual: ${invokeCount}`);
                })
            });
    });

    it('SonarQube common - Build summary is created (dashboard link only when not waiting for server)', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "taskId", "taskUrl");
        var mockServer: ISonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId);
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        return sqReportBuilder.fetchMetricsAndCreateReport(false)
            .then((report:string) => {
                assertBuildSummaryContains(report, '[sqAnalysis_BuildSummary_LinkText >](http://dashboardUrl "projectKey Dashboard")');
            });
    });

    it('SonarQube common - Build summary with details is created with quality gate fail', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'ERROR'; // Quality gate failed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        var unitsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/measurement_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/metrics/search?ps=500&f=name', unitsJsonObject);

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then((buildSummary:string) => {
                assertBuildSummaryContains(buildSummary, '[sqAnalysis_BuildSummary_LinkText >](http://dashboardUrl "projectKey Dashboard")');
                assertBuildSummaryContains(buildSummary, 'Quality Gate');
                assertBuildSummaryContains(buildSummary, 'Failed');

                // Details
                assertBuildSummaryContains(buildSummary, 'Lines');
                assertBuildSummaryContains(buildSummary, '71');
                assertBuildSummaryContains(buildSummary, '&nbsp;&#62; 1'); // "> 1" in escaped HTML

                assertBuildSummaryContains(buildSummary, 'Technical Debt');
                assertBuildSummaryContains(buildSummary, '1h 27min');
                assertBuildSummaryContains(buildSummary, '&nbsp;&#62; 0min'); // "> 0min" in escaped HTML
            });
    });

    it('SonarQube common - Build summary with details is created with quality gate warn', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'WARN'; // Quality gate failed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        var unitsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/measurement_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/metrics/search?ps=500&f=name', unitsJsonObject);

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then((buildSummary:string) => {
                assertBuildSummaryContains(buildSummary, '[sqAnalysis_BuildSummary_LinkText >](http://dashboardUrl "projectKey Dashboard")');
                assertBuildSummaryContains(buildSummary, 'Quality Gate');
                assertBuildSummaryContains(buildSummary, 'Warning');

                // Details
                assertBuildSummaryContains(buildSummary, 'Lines');
                assertBuildSummaryContains(buildSummary, '71');
                assertBuildSummaryContains(buildSummary, '&nbsp;&#62; 1'); // "> 1" in escaped HTML

                assertBuildSummaryContains(buildSummary, 'Technical Debt');
                assertBuildSummaryContains(buildSummary, '1h 27min');
                assertBuildSummaryContains(buildSummary, '&nbsp;&#62; 0min'); // "> 0min" in escaped HTML
            });
    });

    it('SonarQube common - Build summary is created with quality gate pass', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'OK'; // Quality gate passed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then((buildSummary:string) => {
                assertBuildSummaryContains(buildSummary, '[sqAnalysis_BuildSummary_LinkText >](http://dashboardUrl "projectKey Dashboard")');
                assertBuildSummaryContains(buildSummary, 'Quality Gate');
                assertBuildSummaryContains(buildSummary, 'Passed');
            });
    });

    it('SonarQube common - Build summary fails correctly when server returns an error', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject: any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject, 500); // HTTP Error 500 Internal Server Error

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then(() => {
                return Q.reject('Should not have finished successfully');
            }, (error) => {
                assertErrorContains(error, 'sqCommon_InvalidResponseFromServer');
                return Q.when(true);
            });
    });

    it('SonarQube common - Build summary fails correctly when server does not return expected data', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', {}); // Empty object returned by the server

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then(() => {
                return Q.reject('Should not have finished successfully');
            }, (error) => {
                assertErrorContains(error, 'sqCommon_InvalidResponseFromServer');
                return Q.when(true);
            });
    });

    it('SonarQube common - Build summary fails correctly when timeout is triggered', () => {
        // Arrange
        var mockRunSettings: SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer: MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics: SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 2, 1); // override to a 2-second timeout
        var sqReportBuilder: SonarQubeReportBuilder = new SonarQubeReportBuilder(mockRunSettings, analysisMetrics);

        // Mock responses from the server
        var taskDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        taskDetailsJsonObject.task.status = "notsuccess"; // will never return task status as 'SUCCESS'
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject, 200);

        return sqReportBuilder.fetchMetricsAndCreateReport(true)
            .then(() => {
                return Q.reject('Should not have finished successfully');
            }, (error) => {
                assertErrorContains(error, 'sqAnalysis_AnalysisTimeout');
                return Q.when(true);
            });
    });

    it('SonarQube common - Build breaker fails the build when the quality gate has failed', () => {
        // Arrange
        var mockRunSettings:SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer:MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics:SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'ERROR'; // Quality gate failed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        // Act
        return analysisMetrics.fetchTaskResultFromQualityGateStatus()
            .then((taskResult) => {
                assert(taskResult == 1 /* TaskResult.Failed == 1 */, 'Task should have failed.');
            });
    });

    it('SonarQube common - Build breaker does not fail the build when the quality gate has passed', () => {
        // Arrange
        var mockRunSettings:SonarQubeRunSettings = new SonarQubeRunSettings("projectKey", "serverUrl", "http://dashboardUrl", "asdfghjklqwertyuiopz", "taskUrl");
        var mockServer:MockSonarQubeServer = new MockSonarQubeServer();

        var analysisMetrics:SonarQubeMetrics = new SonarQubeMetrics(mockServer, mockRunSettings.ceTaskId, 10, 1); // override to a 10-second timeout

        // Mock responses from the server for the task and analysis details
        var taskDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/task_details.json'), 'utf-8'));
        mockServer.setupMockApiCall('/api/ce/task?id=asdfghjklqwertyuiopz', taskDetailsJsonObject);

        var analysisDetailsJsonObject:any = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/analysis_details.json'), 'utf-8'));
        analysisDetailsJsonObject.projectStatus.status = 'OK'; // Quality gate passed
        mockServer.setupMockApiCall('/api/qualitygates/project_status?analysisId=12345', analysisDetailsJsonObject);

        // capture process.stdout and process.exit, along with useful data to assert on
        var capturedStream = captureStream(process.stdout);
        var capturedExit = process.exit;
        var processExitInvoked:number = 0;
        process.exit = function() { processExitInvoked++; return; };

        // Act
        return analysisMetrics.fetchTaskResultFromQualityGateStatus()
            .then((taskResult) => {
                assert(taskResult == 0 /* TaskResult.Failed == 0 */, 'Task should not have failed.');
            });
    });

    /* Standalone Code Analysis unit tests */

    it('Code Analysis common - createDirectory correctly creates new dir', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');

        // Act
        FileSystemInteractions.createDirectory(newFolder1);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and 1 directory in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        var newFolder1 = path.join(testStgDir, 'fish');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }
        if (!fs.existsSync(newFolder1)) {
            fs.mkdirSync(newFolder1);
        }

        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and 2 directories in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        var newFolder1 = path.join(testStgDir, 'fish');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }
        if (!fs.existsSync(newFolder1)) {
            fs.mkdirSync(newFolder1);
        }

        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and all directories in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');
        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and all directories in between (repeating dir names)', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');
        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'fish');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with illegal chars', function (done) {
        this.timeout(1000);

        var testPath = path.join(createTempDir(), 'mkdir\0');
        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) {
            // asserting failure
            assert(!shell.test('-d', testPath), 'directory should not be created');
        }

        assert(!worked, 'mkdirP with illegal chars should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with null path', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(null);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with null should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with empty path', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory('');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with empty string should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with conflicting file path', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_conflicting_file_path');
        shell.mkdir('-p', createTempDir());
        fs.writeFileSync(testPath, '');
        let worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with conflicting file path should not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with conflicting parent file path', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_conflicting_parent_file_path', 'dir');
        shell.mkdir('-p', createTempDir());
        fs.writeFileSync(path.dirname(testPath), '');
        let worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with conflicting file path should not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory no-ops if mkdirP directory exists', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_dir_exists');
        shell.mkdir('-p', createTempDir());
        fs.mkdirSync(testPath);

        FileSystemInteractions.createDirectory(testPath); // should not throw

        done();
    });
});