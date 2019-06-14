/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import mockHelper = require('../../lib/mockHelper');
import path = require('path');
import fs = require('fs');
import url = require('url');
import {Url} from 'url';
import shell = require('shelljs');

// import {ToolRunner} from 'vsts-task-lib/toolrunner';
import tr = require('../../lib/vsts-task-lib/toolrunner');
import tl = require('../../lib/vsts-task-lib/toolrunner');

import {MockSonarQubeServer} from './server-mock';

let FileSystemInteractions = require('../../../Tasks/Common/codeanalysis-common/Common/FileSystemInteractions').FileSystemInteractions;

import http = require('http');
import {IncomingMessage} from 'http';

import os = require('os');

var isWindows = os.type().match(/^Win/);

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
    process.env['TMPDIR'] = '/tmp';
    process.env['TMP'] = '/tmp';
    process.env['TEMP'] = '/tmp';
}

// Sets up a Maven TaskRunner instance with all of the required default settings
function setupDefaultMavenTaskRunner(): trm.TaskRunner {
    var taskRunner = new trm.TaskRunner('MavenV3', true, true);
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
    taskRunner.setInput('mavenFeedAuthenticate', 'true');

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
function createTempDirsForSonarQubeTests(): void {
    var sqTempDir: string = path.join(createTempDir(), '.sqAnalysis');

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

function createTempDir(): string {
    var testTempDir: string = path.join(__dirname, '_temp');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    return testTempDir;
}

function captureStream(stream): { unhook(): void, captured(): string } {
    var oldWrite = stream.write;
    var buf: string = '';
    stream.write = function (chunk, encoding, callback) {
        buf += chunk.toString(); // chunk is a String or Buffer
        oldWrite.apply(stream, arguments);
    };

    return {
        unhook: function unhook(): void {
            stream.write = oldWrite;
        },
        captured: function (): string {
            return buf;
        }
    };
}

function cleanTempDirsForCodeAnalysisTests(): void {
    var testTempDir: string = path.join(__dirname, '_temp');
    deleteFolderRecursive(testTempDir);
}

function deleteFolderRecursive(path): void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
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

function assertFileExistsInDir(stagingDir: string, filePath: string) {
    var directoryName: string = path.dirname(path.join(stagingDir, filePath));
    var fileName: string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    var directoryContents: string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) > -1, `Expected file did not exist: ${filePath}
    Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertFileDoesNotExistInDir(stagingDir: string, filePath: string) {
    var directoryName: string = path.dirname(path.join(stagingDir, filePath));
    var fileName: string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    var directoryContents: string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) === -1, `Expected file to not exist, but it does: ${filePath}
    Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertErrorContains(error: any, expectedString: string): void {
    assert(error instanceof Error, `Expected an instance of Error to be thrown. Actual: ${typeof error}`);
    assert(error.message.indexOf(expectedString) > -1, `Expected error to contain: ${expectedString}
     Actual: ${error.message}`);
}

function assertStringContains(actualString: string, expectedString: string): void {
    assert(actualString.indexOf(expectedString) > -1, `Expected string to contain: ${expectedString}`);
}


// function assertToolRunnerContainsArg(toolRunner: ToolRunner, expectedArg: string) {
//     return toolRunner.args.indexOf(expectedArg) > -1;
// }

// function assertToolRunnerHasArgLength(toolRunner: ToolRunner, expectedNumArgs: number) {
//     return toolRunner.args.length == expectedNumArgs;
// }

function verifyNoopCodeAnalysis(missingBuildVariable: string, analysisEnabled: string): Q.Promise<void> {
    // In the test data:
    // /: pom.xml, target/.
    // Expected: one module, root.

    // Arrange

    var responseJsonFilePath: string = path.join(__dirname, 'response.json');
    var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));

    // Set mocked build variables
    responseJsonContent.getVariable = responseJsonContent.getVariable || {};
    responseJsonContent.getVariable[missingBuildVariable] = "";

    // Write and set the newly-changed response file
    var newResponseFilePath: string = path.join(__dirname, 'noop_response.json');
    fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
    setResponseFile(path.basename(newResponseFilePath));

    // Set up the task runner with the test settings
    var taskRunner: trm.TaskRunner = setupDefaultMavenTaskRunner();
    taskRunner.setInput('checkstyleAnalysisEnabled', analysisEnabled);
    taskRunner.setInput('pmdAnalysisEnabled', analysisEnabled);
    taskRunner.setInput('findbugsAnalysisEnabled', analysisEnabled);
    taskRunner.setInput('mavenFeedAuthenticate', 'false');

    // Act
    return taskRunner.run()
        .then(() => {
            // Assert
            assert(taskRunner.resultWasSet, 'should have set a result');
            assert(taskRunner.stdout.length > 0, 'should have written to stdout');
            assert(taskRunner.stderr.length == 0, 'should not have written to stderr');
            assert(taskRunner.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(taskRunner.succeeded, 'task should have succeeded');
            assert(taskRunner.ran('/home/bin/maven/bin/mvn -f pom.xml package'),
                'should have run maven with the correct arguments');
            assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') < 0,
                'should have not uploaded a Code Analysis Report build summary');
            assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') < 0,
                'should have not uploaded a code analysis build artifact');

        })
        .fail((err) => {
            console.log(taskRunner.stdout);
            console.log(taskRunner.stderr);
        });
}

describe('Maven Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        Q.longStackSupport = true;
        done();
    });

    after(function () {
    });

    it('run maven with all default inputs and M2_HOME not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
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
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom'), 'it should have generated effective pom');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times: ' + tr.invokedToolCount);
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr=' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('MAVEN_OPTS is now set to -Xmx2048m') > 0);

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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');
        process.env['M2_HOME'] = '/anotherHome/bin/maven/bin/mvn';
        process.env['TMPDIR'] = '/tmp';
        process.env['TMP'] = '/tmp';
        process.env['TEMP'] = '/tmp';

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
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

    it('run maven with missing mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        //tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

    it('run maven with missing mavenFeedAuthenticate', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
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
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenFeedAuthenticate') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with INVALID mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
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

    it('run maven with mavenVersionSelection set to Path (mavenPath valid)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
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

    it('run maven with mavenVersionSelection set to Path (mavenPath missing)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven333')
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

        var tr = new trm.TaskRunner('MavenV3', true);
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
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
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

    it('run maven with mavenSetM2Home set to true', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
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
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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

    it('run maven with feed', (done) => {
        setResponseFile('responseFeed.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom'), 'it should have calculated the effective pom');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml -s /tmp/settings.xml package'), 'it should have run mvn -f pom.xml -s /tmp/settings.xml package');
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

    it('run maven without authenticated feeds', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'false');

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

    it('run maven without authenticated feed and skip effectivePom', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'false');
        tr.setInput('skipEffectivePom', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr:'+tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with feed settings and spaces', (done) => {
        setResponseFile('responseFeedWithSpaces.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '-DoptWithEscaping="{\\\"serverUri\\\": \\\"http://elasticsearch:9200\\\",\\\"username\\\": \\\"elastic\\\", \\\"password\\\": \\\"changeme\\\", \\\"connectionTimeout\\\": 30000}"');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom -DoptWithEscaping={\"serverUri\": \"http://elasticsearch:9200\",\"username\": \"elastic\", \"password\": \"changeme\", \"connectionTimeout\": 30000}'), 'it should have calculated the effective pom');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml -s /tmp/settings.xml -DoptWithEscaping={\"serverUri\": \"http://elasticsearch:9200\",\"username\": \"elastic\", \"password\": \"changeme\", \"connectionTimeout\": 30000} package'), 'it should have run mvn -f pom.xml -s /tmp/settings.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr' + tr.stderr + ' std=' + tr.stdout);
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with feed with settings', (done) => {
        setResponseFile('responseFeed.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o -s settings.xml /p /t');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('cwd', '/usr');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom /o -s settings.xml /p /t'), 'it should have calculated the effective pom');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml -s /tmp/settings.xml /o /p /t package'), 'it should have run mvn -f pom.xml -s /tmp/settings.xml /o /p /t package');
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

    it('run maven with options set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p "/t:i o" /n /s');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t:i o /n /s package'), 'it should have run mvn -f pom.xml /o /p /t:i o /n /s package');
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

    it('run maven with goals not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        //tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
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

    it('run maven with missing publishJUnitResults input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
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

    it('run maven with publishJUnitResults set to "garbage"', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
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

    it('run maven and publish tests', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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

    it('run maven with feed authentication uploads a maven info summary', (done) => {
        setResponseFile('response.json');

        var tr = setupDefaultMavenTaskRunner();
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.stdout.indexOf('##vso[task.debug][Maven] Uploading build maven info from /tmp/.mavenInfo/MavenInfo-') >= 0,
                    'should have uploaded a MavenInfo file');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                done(err);
            });
    })

    it('run maven without feed authentication does not upload a maven info summary', (done) => {
        setResponseFile('response.json');

        var tr = setupDefaultMavenTaskRunner();
        tr.setInput('mavenFeedAuthenticate', 'false');

        tr.run()
            .then(() => {
                assert(tr.stdout.indexOf('##vso[task.debug][Maven] Uploading build maven info from /tmp/.mavenInfo/MavenInfo-') < 0,
                    'should not have uploaded a MavenInfo file');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        //tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');
        tr.setInput('mavenFeedAuthenticate', 'true');

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
                assert(tr.stdout.indexOf('Failed to find the specified JDK version') >= 0, 'JAVA_HOME set?');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with Valid inputs but it fails', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'FAIL package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml FAIL package'), 'it should have run mvn -f pom.xml FAIL package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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
        createTempDir();

        // not a valid PR branch
        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'response.json'),
            path.join(__dirname, 'new_response.json'),
            [["build.sourceBranch", "refspull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir],
                ['System.DefaultWorkingDirectory', testSrcDir]]);
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
        tr.setInput('sqMavenPluginVersionChoice', 'latest');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package org.sonarsource.scanner.maven:sonar-maven-plugin:RELEASE:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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

    it('Maven build with publish test results', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('MavenV3', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'None');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('mavenFeedAuthenticate', 'true');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
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
        responseJsonContent.getVariable['System.DefaultWorkingDirectory'] = testSrcDir;
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

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with PMD - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
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

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
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
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        responseJsonContent.getVariable['System.DefaultWorkingDirectory'] = testSrcDir;
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
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_checkstyle-result_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'root/1_checkstyle_Checkstyle.html');

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with Checkstyle - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
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

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
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
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        responseJsonContent.getVariable['System.DefaultWorkingDirectory'] = testSrcDir;
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

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with FindBugs - Should succeed even if XML output cannot be found', function (done) {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
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

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with code analysis - Only shows empty results for tools which are enabled', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule-noviolations');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        responseJsonContent.getVariable['System.DefaultWorkingDirectory'] = testSrcDir;
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
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') < 0,
                    'should not have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'Checkstyle found no violations.');
                assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'PMD found no violations.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found no violations.');

                // There were no files to be uploaded - the CA folder should not exist
                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'CA');

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with code analysis - Does not upload artifacts if code analysis reports were empty', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule-noviolations');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        responseJsonContent.getVariable['System.DefaultWorkingDirectory'] = testSrcDir;
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

                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') < 0,
                    'should not have uploaded a code analysis build artifact');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found no violations.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found no violations.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found no violations.');

                // The .codeAnalysis dir should have been created to store the build summary, but not the report dirs
                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, 'CA');

                // Clean up
                cleanTempDirsForCodeAnalysisTests();
                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven with code analysis - Does nothing if the tools were not enabled', function (done) {
        // In the test data:
        // /: pom.xml, target/.
        // Expected: one module, root.

        // Arrange
        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
        if (fs.readdirSync(__dirname).indexOf('_temp') < 0) {
            fs.mkdirSync(testStgDir);
        }

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
                assert(taskRunner.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') < 0,
                    'should not have uploaded a Code Analysis Report build summary');
                assert(taskRunner.stdout.indexOf('##vso[artifact.upload artifactname=Code Analysis Results;]') < 0,
                    'should not have uploaded a code analysis build artifact');

                // Nothing should have been created
                assertFileDoesNotExistInDir(testStgDir, '.codeAnalysis');

                // Clean up
                cleanTempDirsForCodeAnalysisTests();

                done();
            })
            .fail((err) => {
                console.log(taskRunner.stdout);
                console.log(taskRunner.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Maven code analysis - NOOP if build variables are not set', function (done) {


        Q.all([
            verifyNoopCodeAnalysis('build.sourcesDirectory', 'true'),
            verifyNoopCodeAnalysis('build.sourcesDirectory', 'false'),
            verifyNoopCodeAnalysis('build.artifactStagingDirectory', 'false'),
            verifyNoopCodeAnalysis('build.artifactStagingDirectory', 'true'),
            verifyNoopCodeAnalysis('build.buildNumber', 'false'),
            verifyNoopCodeAnalysis('build.buildNumber', 'true'),

        ])

            .then(() => done())
            .fail((reason) => done("an error occured: " + reason));
    });

    it('during PR builds SonarQube analysis runs normally', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        tr.setInput('sqMavenPluginVersionChoice', 'latest');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package org.sonarsource.scanner.maven:sonar-maven-plugin:RELEASE:sonar'), 'it should have run SQ analysis in issues mode: std=' + tr.stdout + '; err=' + tr.stderr);
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
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

    /* Standalone Code Analysis unit tests */

    it('Code Analysis common - createDirectory correctly creates new dir', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

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
        createTempDir();
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
        createTempDir();
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
        createTempDir();

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
        createTempDir();

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