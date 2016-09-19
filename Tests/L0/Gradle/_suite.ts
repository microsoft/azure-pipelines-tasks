/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import fs = require('fs');
import mockHelper = require('../../lib/mockHelper');
import path = require('path');

import trm = require('../../lib/taskRunner');
import {TaskRunner} from '../../lib/taskRunner';

import {AnalysisResult} from '../../../Tasks/Gradle/CodeAnalysis/Common/AnalysisResult';
import {BuildOutput, BuildEngine} from '../../../Tasks/Gradle/CodeAnalysis/Common/BuildOutput'
import {CheckstyleTool} from '../../../Tasks/Gradle/CodeAnalysis/Common/CheckstyleTool'
import {PmdTool} from '../../../Tasks/Gradle/CodeAnalysis/Common/PmdTool'

import os = require('os');

var isWindows = os.type().match(/^Win/); 
var gradleWrapper = isWindows ? 'gradlew.bat' : 'gradlew';

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function setDefaultInputs(tr: TaskRunner, enableSonarQubeAnalysis: boolean): TaskRunner {
    tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
    tr.setInput('options', '');
    tr.setInput('tasks', 'build');
    tr.setInput('javaHomeSelection', 'JDKVersion');
    tr.setInput('jdkVersion', 'default');
    tr.setInput('publishJUnitResults', 'true');
    tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

    if (enableSonarQubeAnalysis) {
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqProjectName', 'test_sqProjectName');
        tr.setInput('sqProjectKey', 'test_sqProjectKey');
        tr.setInput('sqProjectVersion', 'test_sqProjectVersion');
    }
    else {
        tr.setInput('sqAnalysisEnabled', 'false');
    }

    return tr;
}

function createTempDirsForCodeAnalysisTests(): void {
    var testTempDir: string = path.join(__dirname, '_temp');
    var caTempDir: string = path.join(testTempDir, '.codeAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(caTempDir)) {
        fs.mkdirSync(caTempDir);
    }
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
    assertBuildSummaryContains(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), expectedString);
}

function assertCodeAnalysisBuildSummaryDoesNotContain(stagingDir: string, string: string): void {
    assertBuildSummaryDoesNotContain(fs.readFileSync(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), 'utf-8'), string);
}

function assertSonarQubeBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(path.join(stagingDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), expectedString);
}

// Asserts the existence of a given line in the build summary file that is uploaded to the server.
function assertBuildSummaryContains(buildSummaryFilePath: string, expectedLine: string): void {
    var buildSummaryString: string = fs.readFileSync(buildSummaryFilePath, 'utf-8');

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

function setResponseAndBuildVars(initialResponseFile: string, finalResponseFile: string, envVars: Array<[string, string]>) {

    var responseJsonFilePath: string = path.join(__dirname, initialResponseFile);
    var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
    for (var envVar of envVars) {
        responseJsonContent.getVariable[envVar[0]] = envVar[1];
    }

    var newResponseFilePath: string = path.join(__dirname, finalResponseFile);
    fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
    setResponseFile(path.basename(newResponseFilePath));
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
    var testTempDir: string = path.join(__dirname, '_temp');
    var sqTempDir: string = path.join(testTempDir, '.sqAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

describe('gradle Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {

    });

    //TODO: The 'Test Run Title' and 'Code Coverage Tool' fields are 
    //      not used by the NodeJS task currently and so are not tested.


    it('run gradle with all default inputs', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('gradleOpts', '-Xmx2048m');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('GRADLE_OPTS is now set to -Xmx2048m') > 0);

                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                done(err);
            });
    })

    it('run gradle with missing wrapperScript', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: wrapperScript') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with INVALID wrapperScript', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', '/home/gradlew');
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found wrapperScript') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with cwd set to valid path', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with cwd set to INVALID path', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('cwd', '/home/repo/src2');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found cwd') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with options set', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' /o /p t i /o /n /s build'), 'it should have run gradlew /o /p t i /o /n /s build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with tasks not set', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: tasks') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with tasks set to multiple', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' /o /p t i /o /n /s build test deploy'), 'it should have run gradlew /o /p t i /o /n /s build test deploy');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with missing publishJUnitResults input', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with publishJUnitResults set to "garbage"', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
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
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o "/p t i" /o /n /s');
        tr.setInput('tasks', 'build test deploy');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run gradle');
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

    it('run gradle with jdkVersion set to 1.8', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('Set JAVA_HOME to /user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run gradle with jdkVersion set to 1.5', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                if (isWindows) {
                    assert(tr.invokedToolCount == 1, 'should not have run gradle'); // should have run reg query toolrunner once
                } else {
                    assert(tr.invokedToolCount == 0, 'should not have run gradle');
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

    it('run gradle with Valid inputs but it fails', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build FAIL');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' build FAIL'), 'it should have run gradlew build FAIL');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
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

    it('Gradle build with publish test results.', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('codeCoverageTool', 'None');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Gradle build with publish test results with no matching test result files.', (done) => {
        setResponseFile('gradleGood.json');

        var tr = new TaskRunner('Gradle');
        tr.setInput('wrapperScript', 'gradlew'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('tasks', 'build');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '*InvalidTestFilter*.xml');
        tr.setInput('codeCoverageTool', 'None');

        tr.run()
            .then(() => {
                assert(tr.stdout.search(/##vso\[results.publish\]/) < 0, "publish test results should not have got called.")
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.stdout.search(/##vso\[task.issue type=warning;\]No test result files matching/) >= 0, 'should have produced warning.');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Gradle with SQ in a PR build - SQ issues mode analysis', function (done) {

        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json'), 'sq issues mode');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SQ - source branch not a PR branch', function (done) {

        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [["build.sourceBranch", "other/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'), 'it should not run in issues mode');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SQ - scc is not TfsGit', function (done) {

        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "ExternalGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'), 'it should not run in issues mode');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SonarQube - Should run Gradle with all default inputs when SonarQube analysis disabled', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        setResponseFile('gradleSonarQube.json');

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, false);
        tr.setInput('sqAnalysisEnabled', 'false');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(tr.ran(gradleWrapper + ' build'), 'it should have run only the default settings');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });
    });

    it('Gradle with Cobertura and SonarQube', function (done) {
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);
        tr.setInput('codeCoverageTool', 'Cobertura');

        tr.run()
            .then(() => {
                assert(tr.ran(gradleWrapper + ' properties'), 'it should have run gradlew build');
                assert(tr.ran(gradleWrapper + ' clean build cobertura sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.cobertura.reportPath=CCReport43F6D5EF/coverage.xml'), 'it should have run gradlew build');
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

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    })

    it('Gradle with SonarQube - Should run Gradle with SonarQube', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');

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

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SonarQube - Fails if the task report is invalid', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-invalid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.failed, 'task should not have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 0,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SonarQube - Fails if the task report is missing', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = __dirname
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.failed, 'task should not have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 0,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SonarQube - Does not fail if report-task.txt is missing during a PR build', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = __dirname;
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [["build.sourceBranch", "refs/pull/6/master"], ["build.repository.provider", "TFSGit"],
                ['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length < 1, 'should not have written to stderr');
                assert(tr.ran(
                    gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json'
                ), 'should have run the gradle wrapper with the appropriate SonarQube arguments');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') < 0,
                    'should not have uploaded a SonarQube Analysis Report build summary');
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube and apply required parameters for older server versions', function (done) {
        // Arrange
        createTempDirsForSonarQubeTests();
        var testSrcDir: string = path.join(__dirname, 'data', 'taskreport-valid');
        var testStgDir: string = path.join(__dirname, '_temp');

        mockHelper.setResponseAndBuildVars(
            path.join(__dirname, 'gradleSonarQube.json'),
            path.join(__dirname, this.test.title + '_response.json'),
            [['build.sourcesDirectory', testSrcDir], ['build.artifactStagingDirectory', testStgDir]]);
        var responseJsonFilePath: string = path.join(__dirname, this.test.title + '_response.json');
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

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, true);

        tr.setInput('sqDbDetailsRequired', 'true');
        tr.setInput('sqDbUrl', 'jdbc:test:tcp://localhost:8080/sonar');
        tr.setInput('sqDbUsername', 'testDbUsername');
        tr.setInput('sqDbPassword', 'testDbPassword');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
                assert(tr.ran(gradleWrapper + ' build sonarqube -I /Gradle/CodeAnalysis/sonar.gradle -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=jdbc:test:tcp://localhost:8080/sonar -Dsonar.jdbc.username=testDbUsername -Dsonar.jdbc.password=testDbPassword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion'),
                    'should have run the gradle wrapper with the appropriate SonarQube arguments');

                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=SonarQube Analysis Report') > 0,
                    'should have uploaded a SonarQube Analysis Report build summary');
                assertSonarQubeBuildSummaryContains(testStgDir,
                    '[Detailed SonarQube report >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');
                done();
            })
            .fail((err) => {
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Single Module Gradle with PMD and Checkstyle', function (done) {

        createTempDirsForCodeAnalysisTests();

        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        setResponseAndBuildVars(
            'gradleCA.json',
            this.test.title + '_response.json',
            [
                ["build.buildNumber", "14"],
                ['build.sourcesDirectory', testSrcDir],
                ['build.artifactStagingDirectory', testStgDir]
            ]);

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, false);
        tr.setInput('pmdAnalysisEnabled', 'true');
        tr.setInput('checkstyleAnalysisEnabled', 'true');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build -I /Gradle/CodeAnalysis/checkstyle.gradle -I /Gradle/CodeAnalysis/pmd.gradle'), 'Ran Gradle with Checkstyle and Pmd');
                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(tr.stdout.indexOf('artifact.upload artifactname=Code Analysis Results;') > -1,
                    'should have uploaded code analysis build artifacts');

                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 35 violations in 2 file');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 4 violations in 2 files');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files were copied for module "root", build 14
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_Checkstyle.html');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_PMD.xml');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_Checkstyle.html');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_PMD.xml');


                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Gradle with code analysis - Only shows empty results for tools which are enabled', function (done) {

        createTempDirsForCodeAnalysisTests();

        var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule-noviolations');
        var testStgDir: string = path.join(__dirname, '_temp');

        setResponseAndBuildVars(
            'gradleCA.json',
            this.test.title + '_response.json',
            [
                ["build.buildNumber", "14"],
                ['build.sourcesDirectory', testSrcDir],
                ['build.artifactStagingDirectory', testStgDir]
            ]);

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, false);
        tr.setInput('pmdAnalysisEnabled', 'true');
        tr.setInput('checkstyleAnalysisEnabled', 'false');

        // Act
        tr.run()
            .then(() => {
                // Assert
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build -I /Gradle/CodeAnalysis/pmd.gradle'), 'Ran Gradle with PMD');
                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(tr.stdout.indexOf('artifact.upload artifactname=Code Analysis Results;') > -1,
                    'should have uploaded code analysis build artifacts');

                assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'Checkstyle found no violations.');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found no violations.');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files were copied for module "root", build 14
                assertFileDoesNotExistInDir(codeAnalysisStgDir, '/root/14_main_Checkstyle.xml');
                assertFileDoesNotExistInDir(codeAnalysisStgDir, '/root/14_main_PMD.xml');

                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    it('Multi Module Gradle with Checkstyle and PMD', function (done) {

        createTempDirsForCodeAnalysisTests();

        var testSrcDir: string = path.join(__dirname, 'data', 'multimodule');
        var testStgDir: string = path.join(__dirname, '_temp');

        setResponseAndBuildVars(
            'gradleCA.json',
            this.test.title + '_response.json',
            [
                ["build.buildNumber", "211"],
                ['build.sourcesDirectory', testSrcDir],
                ['build.artifactStagingDirectory', testStgDir]
            ]);

        var tr = new TaskRunner('Gradle', true, true);
        tr = setDefaultInputs(tr, false);
        tr.setInput('pmdAnalysisEnabled', 'true');
        tr.setInput('checkstyleAnalysisEnabled', 'true');

        // Act
        tr.run()
            .then(() => {
                // Assert
                    assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 1, 'should have only run gradle 1 time');
                assert(tr.resultWasSet, 'task should have set a result');
                 assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.ran(gradleWrapper + ' build -I /Gradle/CodeAnalysis/checkstyle.gradle -I /Gradle/CodeAnalysis/pmd.gradle'), 'Ran Gradle with Checkstyle and Pmd');
                assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=Code Analysis Report') > -1,
                    'should have uploaded a Code Analysis Report build summary');
                assert(tr.stdout.indexOf('artifact.upload artifactname=Code Analysis Results;') > -1,
                    'should have uploaded PMD build artifacts');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 2 violations in 1 file');
                assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 34 violations in 2 files');

                var codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

                // Test files copied for module "module-one", build 211
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_main_Checkstyle.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_main_Checkstyle.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_main_PMD.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_main_PMD.xml');
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_test_Checkstyle.html');
                assertFileExistsInDir(codeAnalysisStgDir, 'module-one/211_test_Checkstyle.xml');

                // Test files were copied for module "module-two", build 211
                // None - the checkstyle reports have no violations and are not uploaded

                // Test files were copied for module "module-three", build 211
                // None - the pmd reports have no violations and are not uploaded

                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.log(tr.stderr);
                console.log(err);
                done(err);
            });

        // Clean up
        cleanTempDirsForCodeAnalysisTests();
    });

    class CheckstyleTestTool extends CheckstyleTool {
        public isEnabled() {
            return true;
        }
    }

    function verifyModuleResult(results: AnalysisResult[], moduleName: string , expectedViolationCount: number, expectedFileCount: number, expectedReports: string[]) {
        var analysisResults = results.filter(ar => ar.moduleName === moduleName);
        assert(analysisResults != null && analysisResults.length != 0 , "Null or empty array");
        assert(analysisResults.length == 1, "The array does not have a single element");
        var analysisResult = analysisResults[0];

        assert(analysisResult.affectedFileCount === expectedFileCount, "Invalid file count");
        assert(analysisResult.violationCount === expectedViolationCount, "Invalid violation count");
        assert(analysisResult.resultFiles.length === expectedReports.length, "Invalid number of reports");

        for (var actualReport of analysisResult.resultFiles) {
            var reportFile = path.basename(actualReport);
            assert(expectedReports.indexOf(reportFile) > -1, "Report not found: " + actualReport);
        }
    }

    it('Checkstyle tool retrieves results', function (done) {

        var testSrcDir: string = path.join(__dirname, 'data', 'multimodule');

        let buildOutput: BuildOutput = new BuildOutput(testSrcDir, BuildEngine.Gradle);
        var tool = new CheckstyleTestTool(buildOutput, 'checkstyleAnalysisEnabled');
        let results: AnalysisResult[] = tool.processResults();

        assert(results.length == 2, "Unexpected number of results. note that module-three has no tool results ");
        verifyModuleResult(results, "module-one", 34, 2, ["main.xml", "main.html", "test.xml", "test.html"] );
        verifyModuleResult(results, "module-two", 0, 0, [] /* empty report files are not copied in */);

        done();
    });

     class PmdTestTool extends PmdTool {
        public isEnabled() {
            return true;
        }
     }

     it('Pmd tool retrieves results', function (done) {

        var testSrcDir: string = path.join(__dirname, 'data', 'multimodule');

        let buildOutput: BuildOutput = new BuildOutput(testSrcDir, BuildEngine.Gradle);
        var tool = new PmdTestTool(buildOutput, 'checkstyleAnalysisEnabled');
        let results: AnalysisResult[] = tool.processResults();

        assert(results.length == 2, "Unexpected number of results. note that module-three has no tool results ");
        verifyModuleResult(results, "module-one", 2, 1, ["main.xml", "main.html"] );
        verifyModuleResult(results, "module-three", 0, 0, [] /* empty report files are not copied in */);

        done();
    });
});