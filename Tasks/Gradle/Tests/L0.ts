// npm install mocha --save-dev
// typings install dt~mocha --save --global

import assert = require('assert');
import path = require('path');
import os = require('os');
import fs = require('fs');

import * as ttm from 'vsts-task-lib/mock-test';

import { BuildOutput, BuildEngine } from '../CodeAnalysis/Common/BuildOutput';
import { PmdTool } from '../CodeAnalysis/Common/PmdTool';
import { CheckstyleTool } from '../CodeAnalysis/Common/CheckstyleTool';
import { FindbugsTool } from '../CodeAnalysis/Common/FindbugsTool';
import { AnalysisResult } from '../CodeAnalysis/Common/AnalysisResult';

let isWindows: RegExpMatchArray = os.type().match(/^Win/);
let gradleWrapper: string = isWindows ? 'gradlew.bat' : 'gradlew';

let gradleFile: string = '/Gradle/CodeAnalysis/sonar.gradle';
let ccCoverageXmlFile: string = 'CCReport43F6D5EF/coverage.xml';
let checkstyleFile: string = '/Gradle/CodeAnalysis/checkstyle.gradle';
let findbugsFile: string = '/Gradle/CodeAnalysis/findbugs.gradle';
let pmdFile: string = '/Gradle/CodeAnalysis/pmd.gradle';
// Fix up argument paths for Windows
if (isWindows) {
    gradleFile = '\\Gradle\\CodeAnalysis\\sonar.gradle';
    ccCoverageXmlFile = 'CCReport43F6D5EF\\coverage.xml';
    checkstyleFile = '\\Gradle\\CodeAnalysis\\checkstyle.gradle';
    findbugsFile = '\\Gradle\\CodeAnalysis\\findbugs.gradle';
    pmdFile = '\\Gradle\\CodeAnalysis\\pmd.gradle';
}

 function assertFileDoesNotExistInDir(stagingDir:string, filePath:string): void {
    let directoryName: string = path.dirname(path.join(stagingDir, filePath));
    let fileName: string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    let directoryContents: string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) === -1, `Expected file to not exist, but it does: ${filePath} Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertBuildSummaryDoesNotContain(buildSummaryString: string, str: string): void {
    assert(buildSummaryString.indexOf(str) === -1, `Expected build summary to not contain: ${str} Actual: ${buildSummaryString}`);
}

function assertCodeAnalysisBuildSummaryDoesNotContain(stagingDir: string, unexpectedString: string): void {
    assertBuildSummaryDoesNotContain(fs.readFileSync(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), 'utf-8'), unexpectedString);
}

function assertFileExistsInDir(stagingDir:string, filePath:string) {
    let directoryName: string = path.dirname(path.join(stagingDir, filePath));
    let fileName: string = path.basename(filePath);
    assert(fs.statSync(directoryName).isDirectory(), 'Expected directory did not exist: ' + directoryName);
    let directoryContents: string[] = fs.readdirSync(directoryName);
    assert(directoryContents.indexOf(fileName) > -1, `Expected file did not exist: ${filePath} Actual contents of ${directoryName}: ${directoryContents}`);
}

function assertCodeAnalysisBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(path.join(stagingDir, '.codeAnalysis', 'CodeAnalysisBuildSummary.md'), expectedString);
}

function assertBuildSummaryContains(buildSummaryFilePath: string, expectedLine: string): void {
    let buildSummaryString: string = fs.readFileSync(buildSummaryFilePath, 'utf-8');

    assert(buildSummaryString.indexOf(expectedLine) > -1, `Expected build summary to contain: ${expectedLine} Actual: ${buildSummaryString}`);
}

function assertSonarQubeBuildSummaryContains(stagingDir: string, expectedString: string): void {
    assertBuildSummaryContains(path.join(stagingDir, '.sqAnalysis', 'SonarQubeBuildSummary.md'), expectedString);
}

function deleteFolderRecursive(path):void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            let curPath: string = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

function cleanTemporaryFolders():void {
    let testTempDir: string = path.join(__dirname, '_temp');
    deleteFolderRecursive(testTempDir);
}

function createTemporaryFolders(): void {
    let testTempDir: string = path.join(__dirname, '_temp');
    let sqTempDir: string = path.join(testTempDir, '.sqAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

describe('Gradle L0 Suite', function () {
    this.timeout(20000);

    before((done) => {
        done();
    });

    /* tslint:disable:no-empty */
    after(function () { });
    /* tslint:enable:no-empty */

    it('run gradle with all default inputs', (done) => {
        let tp: string = path.join(__dirname, 'L0AllDefaultInputs.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('GRADLE_OPTS is now set to -Xmx2048m') > 0);

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with missing wrapperScript', (done) => {
        let tp: string = path.join(__dirname, 'L0MissingWrapperScript.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: wrapperScript') >= 0, 'wrong error message: "' + tr.stdout + '"');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with INVALID wrapperScript', (done) => {
        let tp: string = path.join(__dirname, 'L0InvalidWrapperScript.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            // /home/gradlew is from L0InvalidWrapperScript.ts
            assert(tr.stdout.indexOf('Not found /home/gradlew') >= 0, 'wrong error message: "' + tr.stdout + '"');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with cwd set to valid path', (done) => {
        let tp: string = path.join(__dirname, 'L0ValidCwdPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            // /home/repo/src is from L0ValidCwdPath.ts
            assert(tr.stdout.indexOf('cwd=/home/repo/src') > 0);
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with cwd set to INVALID path', (done) => {
        let tp: string = path.join(__dirname, 'L0InvalidPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            // /home/repo/src2 is from L0InvalidPath.ts
            assert(tr.stdout.indexOf('Not found /home/repo/src2') >= 0, 'wrong error message: "' + tr.stdout + '"');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with options set', (done) => {
        let tp: string = path.join(__dirname, 'L0OptionsSet.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            // ' /o /p t i /o /n /s build' is from L0OptionsSet.ts
            assert(tr.ran(gradleWrapper + ' /o /p t i /o /n /s build'), 'it should have run gradlew /o /p t i /o /n /s build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with tasks not set', (done) => {
        let tp: string = path.join(__dirname, 'L0TasksNotSet.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: tasks') >= 0, 'wrong error message: "' + tr.stdout + '"');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with tasks set to multiple', (done) => {
        let tp: string = path.join(__dirname, 'L0MultipleTasks.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' /o /p t i /o /n /s build test deploy'), 'it should have run gradlew /o /p t i /o /n /s build test deploy');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with missing publishJUnitResults input', (done) => {
        let tp: string = path.join(__dirname, 'L0MissingPublishJUnitResultsInput.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with publishJUnitResults set to "garbage"', (done) => {
        let tp: string = path.join(__dirname, 'L0GarbagePublishJUnitResults.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('fails if missing testResultsFiles input', (done) => {
        let tp: string = path.join(__dirname, 'L0MissingTestResultsFilesInput.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: testResultsFiles') >= 0, 'wrong error message: "' + tr.stdout + '"');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('fails if missing javaHomeSelection input', (done) => {
        let tp: string = path.join(__dirname, 'L0MissingJavaHomeSelectionInput.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.invokedToolCount === 0, 'should not have run gradle');
            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: javaHomeSelection') >= 0, 'wrong error message: "' + tr.stdout + '"');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with jdkVersion set to 1.8', (done) => {
        let tp: string = path.join(__dirname, 'L0JDKVersion18.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('Set JAVA_HOME to /user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with jdkVersion set to 1.5', (done) => {
        let tp: string = path.join(__dirname, 'L0JDKVersion15.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            if (isWindows) {
                // should have run reg query toolrunner once
                assert(tr.invokedToolCount === 1, 'should not have run gradle');
            } else {
                assert(tr.invokedToolCount === 0, 'should not have run gradle');
            }
            assert(tr.failed, 'task should have failed');
            //jeyou: loc issue
            assert(tr.stdout.indexOf('loc_mock_FailedToLocateSpecifiedJVM') >= 0, 'JAVA_HOME set?');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run gradle with Valid inputs but it fails', (done) => {
        let tp: string = path.join(__dirname, 'L0ValidInputsFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.ran(gradleWrapper + ' build FAIL'), 'it should have run gradlew build FAIL');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('FAILED') >= 0, 'It should have failed');
            assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-results\/test-123.xml;\]/) >= 0);

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle build with publish test results.', (done) => {
        let tp: string = path.join(__dirname, 'L0PublishTestResults.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0);
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle build with publish test results with no matching test result files.', (done) => {
        let tp: string = path.join(__dirname, 'L0PublishTestResultsNoMatchingResultFiles.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.search(/##vso\[results.publish\]/) < 0, 'publish test results should not have got called.');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.search(/##vso\[task.issue type=warning;\]No test result files matching/) >= 0, 'should have produced warning.');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SQ in a PR build - SQ issues mode analysis', function (done) {
        let tp: string = path.join(__dirname, 'L0SQInPRBuildSQIssuesModeAnalysis.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json`), 'sq issues mode');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SQ - source branch not a PR branch', function (done) {
        let tp: string = path.join(__dirname, 'L0SQSourceBranchNotPRBranch.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`), 'it should not run in issues mode');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SQ - scc is not TfsGit', function (done) {
        let tp: string = path.join(__dirname, 'L0SQSccNotTfsGit.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`), 'it should not run in issues mode');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Should run Gradle with all default inputs when SonarQube analysis disabled', function (done) {
        let tp: string = path.join(__dirname, 'L0SQGradleDefaultSQDisabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(tr.ran(gradleWrapper + ' build'), 'it should have run only the default settings');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with Cobertura and SonarQube', function (done) {
        let tp: string = path.join(__dirname, 'L0CoberturaSQ.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.invokedToolCount === 2, 'should have only run gradle 2 times');
            assert(tr.ran(gradleWrapper + ' properties'), 'it should have run gradlew properties');
            assert(tr.ran(gradleWrapper + ` clean build cobertura sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.cobertura.reportPath=${ccCoverageXmlFile}`), 'it should have run gradlew clean build cobertura sonarqube');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube', function (done) {
        let tp: string = path.join(__dirname, 'L0SQ.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();
            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`), 'should have run the gradle wrapper with the appropriate SonarQube arguments');
            //jeyou: loc_mock_sqAnalysis_BuildSummaryTitle instead of SonarQube Analysis Report (do tests need to do something to set up loc?)
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_sqAnalysis_BuildSummaryTitle') > 0,
                   'should have uploaded a SonarQube Analysis Report build summary');
            //jeyou: loc_mock_sqAnalysis_BuildSummary_LinkText instead of Detailed SonarQube report
            assertSonarQubeBuildSummaryContains(testStgDir,
                                                '[loc_mock_sqAnalysis_BuildSummary_LinkText >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');

            cleanTemporaryFolders();

            done();
        } catch (err) { //jeyou: Add this to previous tests
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Fails if the task report is invalid', function (done) {
        let tp: string = path.join(__dirname, 'L0SQFailsTaskReportInvalid.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.failed, 'task should not have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`), 'should have run the gradle wrapper with the appropriate SonarQube arguments');

           //jeyou: loc_mock_sqAnalysis_BuildSummaryTitle instead of SonarQube Analysis Report (do tests need to do something to set up loc?)
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_sqAnalysis_BuildSummaryTitle') < 0,
                   'should not have uploaded a SonarQube Analysis Report build summary');

            cleanTemporaryFolders();
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Fails if the task report is missing', function (done) {
        let tp: string = path.join(__dirname, 'L0SQFailsTaskReportMissing.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.failed, 'task should not have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`),
                   'should have run the gradle wrapper with the appropriate SonarQube arguments');

            //jeyou: loc_mock_sqAnalysis_BuildSummaryTitle instead of SonarQube Analysis Report (do tests need to do something to set up loc?)
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_sqAnalysis_BuildSummaryTitle') < 0,
                   'should not have uploaded a SonarQube Analysis Report build summary');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Does not fail if report-task.txt is missing during a PR build', function (done) {
        let tp: string = path.join(__dirname, 'L0SQFailsTaskReportMissingPRBuild.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length < 1, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion -Dsonar.analysis.mode=issues -Dsonar.report.export.path=sonar-report.json`),
                   'should have run the gradle wrapper with the appropriate SonarQube arguments');

            //jeyou: loc_mock_sqAnalysis_BuildSummaryTitle instead of SonarQube Analysis Report (do tests need to do something to set up loc?)
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_sqAnalysis_BuildSummaryTitle') < 0,
                   'should not have uploaded a SonarQube Analysis Report build summary');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with SonarQube - Should run Gradle with SonarQube and apply required parameters for older server versions', function (done) {
        let tp: string = path.join(__dirname, 'L0SQOnlyRequiredParametersOlderServerVersions.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(tr.ran(gradleWrapper + ` build sonarqube -I ${gradleFile} -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=jdbc:test:tcp://localhost:8080/sonar -Dsonar.jdbc.username=testDbUsername -Dsonar.jdbc.password=testDbPassword -Dsonar.projectName=test_sqProjectName -Dsonar.projectKey=test_sqProjectKey -Dsonar.projectVersion=test_sqProjectVersion`),
                   'should have run the gradle wrapper with the appropriate SonarQube arguments');

            //jeyou: loc_mock_sqAnalysis_BuildSummaryTitle instead of SonarQube Analysis Report (do tests need to do something to set up loc?)
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_sqAnalysis_BuildSummaryTitle') > 0,
                   'should have uploaded a SonarQube Analysis Report build summary');
            //jeyou: loc_mock_sqAnalysis_BuildSummary_LinkText instead of Detailed SonarQube report
            assertSonarQubeBuildSummaryContains(testStgDir, '[loc_mock_sqAnalysis_BuildSummary_LinkText >](http://sonarqubeserver:9000/dashboard/index/test "test Dashboard")');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Single Module Gradle with Checkstyle and FindBugs and PMD', function (done) {
        let tp: string = path.join(__dirname, 'L0SingleModuleCheckstyleFindBugsPMD.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build -I ${checkstyleFile} -I ${findbugsFile} -I ${pmdFile}`),
                   'Ran Gradle with Checkstyle and Findbugs and Pmd');
            // jeyou: loc_mock_codeAnalysisBuildSummaryTitle instead of Code Analysis Report
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_codeAnalysisBuildSummaryTitle') > -1,
                   'should have uploaded a Code Analysis Report build summary');
            // jeyou: loc_mock_codeAnalysisArtifactSummaryTitle instead of Code Analysis Results 
            assert(tr.stdout.indexOf('artifact.upload artifactname=loc_mock_codeAnalysisArtifactSummaryTitle;') > -1,
                   'should have uploaded code analysis build artifacts');

            //jeyou: the following 3 checks fail due to loc issues
            //jassertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 35 violations in 2 file');
            //jassertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 4 violations in 2 files');
            // jeyou: only 1 violation is found in 1 file (for some reason)
            //jassertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found 5 violations in 1 file.');

            let codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

            // Test files were copied for module "root", build 14
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_Checkstyle.html');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_Checkstyle.xml');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_PMD.html');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_main_PMD.xml');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_Checkstyle.html');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_Checkstyle.xml');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_PMD.html');
            assertFileExistsInDir(codeAnalysisStgDir, '/root/14_test_PMD.xml');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with code analysis - Only shows empty results for tools which are enabled', function (done) {
        let tp: string = path.join(__dirname, 'L0CAEmptyResultsEnabledTools.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper + ` build -I ${pmdFile}`), 'Ran Gradle with PMD');
            // jeyou: loc_mock_codeAnalysisBuildSummaryTitle instead of Code Analysis Report
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_codeAnalysisBuildSummaryTitle') > -1,
                   'should have uploaded a Code Analysis Report build summary');
            // jeyou: loc_mock_codeAnalysisArtifactSummaryTitle instead of Code Analysis Results 
            assert(tr.stdout.indexOf('artifact.upload artifactname=loc_mock_codeAnalysisArtifactSummaryTitle;') < 0,
                   'should not have uploaded code analysis build artifacts');

            assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'FindBugs found no violations.');
            assertCodeAnalysisBuildSummaryDoesNotContain(testStgDir, 'Checkstyle found no violations.');
            //jeyou: loc_mock_codeAnalysisBuildSummaryLine_NoViolations instead of PMD found no violations. 
            assertCodeAnalysisBuildSummaryContains(testStgDir, 'loc_mock_codeAnalysisBuildSummaryLine_NoViolations');

            // There were no files to be uploaded - the CA folder should not exist
            let codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis');
            assertFileDoesNotExistInDir(codeAnalysisStgDir, 'CA');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with code analysis - Does not upload artifacts if code analysis reports were empty', function (done) {
        let tp: string = path.join(__dirname, 'L0CANoUploadArtifactsIfReportsEmpty.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            //var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule-noviolations');
            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.ran(gradleWrapper +
                   ` build -I ${checkstyleFile} -I ${findbugsFile} -I ${pmdFile}`),
                   'should have run Gradle with code analysis tools');

            // jeyou: loc_mock_codeAnalysisBuildSummaryTitle instead of Code Analysis Report
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_codeAnalysisBuildSummaryTitle') > -1,
                   'should have uploaded a Code Analysis Report build summary');

            // jeyou: loc_mock_codeAnalysisArtifactSummaryTitle instead of Code Analysis Results
            assert(tr.stdout.indexOf('##vso[artifact.upload artifactname=loc_mock_codeAnalysisArtifactSummaryTitle;]') < 0,
                   'should not have uploaded a code analysis build artifact');

            //jeyou: loc_mock_codeAnalysisBuildSummaryLine_NoViolations instead of Checkstyle found no violations.
            assertCodeAnalysisBuildSummaryContains(testStgDir, 'loc_mock_codeAnalysisBuildSummaryLine_NoViolations');
            //jeyou: loc_mock_codeAnalysisBuildSummaryLine_NoViolations instead of PMD found no violations.
            assertCodeAnalysisBuildSummaryContains(testStgDir, 'loc_mock_codeAnalysisBuildSummaryLine_NoViolations');
            //jeyou: loc_mock_codeAnalysisBuildSummaryLine_NoViolations instead of FindBugs found no violations.
            assertCodeAnalysisBuildSummaryContains(testStgDir, 'loc_mock_codeAnalysisBuildSummaryLine_NoViolations');

            // The .codeAnalysis dir should have been created to store the build summary, but not the report dirs
            let codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis');
            assertFileDoesNotExistInDir(codeAnalysisStgDir, 'CA');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Gradle with code analysis - Does nothing if the tools were not enabled', function (done) {
        let tp: string = path.join(__dirname, 'L0CANoToolsEnabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            //var testSrcDir: string = path.join(__dirname, 'data', 'singlemodule');
            let testStgDir: string = path.join(__dirname, '_temp');

            createTemporaryFolders();

            tr.run();

            assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.stdout.indexOf('task.issue type=warning;') < 0, 'should not have produced any warnings');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            // jeyou: loc_mock_codeAnalysisBuildSummaryTitle instead of Code Analysis Report
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_codeAnalysisBuildSummaryTitle') < 0,
                   'should not have uploaded a Code Analysis Report build summary');
            // jeyou: loc_mock_codeAnalysisArtifactSummaryTitle instead of Code Analysis Results
            assert(tr.stdout.indexOf('##vso[artifact.upload artifactname=loc_mock_codeAnalysisArtifactSummaryTitle;]') < 0,
                   'should not have uploaded a code analysis build artifact');

            // Nothing should have been created
            assertFileDoesNotExistInDir(testStgDir, '.codeAnalysis');

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Multi Module Gradle with Checkstyle and FindBugs and PMD', function (done) {
        let tp: string = path.join(__dirname, 'L0MultiModuleCheckstyleFindBugsPMD.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            createTemporaryFolders();

            let testStgDir: string = path.join(__dirname, '_temp');

            tr.run();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            assert(tr.stderr.length === 0, 'should not have written to stderr');
            assert(tr.ran(gradleWrapper +
                   ` build -I ${checkstyleFile} -I ${findbugsFile} -I ${pmdFile}`),
                   'should have run Gradle with code analysis tools');
            // jeyou: loc_mock_codeAnalysisBuildSummaryTitle instead of Code Analysis Report
            assert(tr.stdout.indexOf('task.addattachment type=Distributedtask.Core.Summary;name=loc_mock_codeAnalysisBuildSummaryTitle') > -1,
                   'should have uploaded a Code Analysis Report build summary');
            // jeyou: loc_mock_codeAnalysisArtifactSummaryTitle instead of Code Analysis Results
            assert(tr.stdout.indexOf('artifact.upload artifactname=loc_mock_codeAnalysisArtifactSummaryTitle;') > -1,
                   'should have uploaded PMD build artifacts');
            //jeyou: The following three fail due to loc issues
            // assertCodeAnalysisBuildSummaryContains(testStgDir, 'PMD found 2 violations in 1 file');
            // assertCodeAnalysisBuildSummaryContains(testStgDir, 'Checkstyle found 34 violations in 2 files');
            // assertCodeAnalysisBuildSummaryContains(testStgDir, 'FindBugs found 5 violations in 1 file.');

            let codeAnalysisStgDir: string = path.join(testStgDir, '.codeAnalysis', 'CA');

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

            cleanTemporaryFolders();

            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    // /* BEGIN Tools tests */
    function verifyModuleResult(results: AnalysisResult[], moduleName: string , expectedViolationCount: number, expectedFileCount: number, expectedReports: string[]) {
        let analysisResults = results.filter(ar => ar.moduleName === moduleName);
        assert(analysisResults !== null && analysisResults.length !== 0 , 'Null or empty array');
        assert(analysisResults.length === 1, 'The array does not have a single element');
        let analysisResult = analysisResults[0];

        assert(analysisResult.affectedFileCount === expectedFileCount, `Expected ${expectedFileCount} files, actual: ${analysisResult.affectedFileCount}`);
        assert(analysisResult.violationCount === expectedViolationCount, `Expected ${expectedViolationCount} violations, actual: ${analysisResult.violationCount}`);
        assert(analysisResult.resultFiles.length === expectedReports.length, `Invalid number of reports`);

        for (let actualReport of analysisResult.resultFiles) {
            let reportFile: string = path.basename(actualReport);
            assert(expectedReports.indexOf(reportFile) > -1, 'Report not found: ' + actualReport);
        }
    }

    it('Checkstyle tool retrieves results', function (done) {
        let testSrcDir: string = path.join(__dirname, 'data', 'multimodule');

        let buildOutput: BuildOutput = new BuildOutput(testSrcDir, BuildEngine.Gradle);
        let tool = new CheckstyleTool(buildOutput, 'checkstyleAnalysisEnabled');
        tool.isEnabled = () => true;
        let results: AnalysisResult[] = tool.processResults();

        assert(results.length === 2, 'Unexpected number of results. note that module-three has no tool results ');
        verifyModuleResult(results, 'module-one', 34, 2, ['main.xml', 'main.html', 'test.xml', 'test.html'] );
        verifyModuleResult(results, 'module-two', 0, 0, [] /* empty report files are not copied in */);

        done();
    });

    it('Pmd tool retrieves results', function (done) {
        let testSrcDir: string = path.join(__dirname, 'data', 'multimodule');

        let buildOutput: BuildOutput = new BuildOutput(testSrcDir, BuildEngine.Gradle);
        let tool = new PmdTool(buildOutput, 'checkstyleAnalysisEnabled');
        tool.isEnabled = () => true;
        let results: AnalysisResult[] = tool.processResults();

        assert(results.length === 2, 'Unexpected number of results. note that module-three has no tool results ');
        verifyModuleResult(results, 'module-one', 2, 1, ['main.xml', 'main.html'] );
        verifyModuleResult(results, 'module-three', 0, 0, [] /* empty report files are not copied in */);

        done();
    });

    it('FindBugs tool retrieves results', function (done) {
        let testSrcDir: string = path.join(__dirname, 'data', 'multimodule');

        let buildOutput: BuildOutput = new BuildOutput(testSrcDir, BuildEngine.Gradle);
        let tool = new FindbugsTool(buildOutput, 'findbugsAnalysisEnabled');
        tool.isEnabled = () => true;
        let results: AnalysisResult[] = tool.processResults();

        assert(results.length === 1, 'Unexpected number of results. Expected 1 (only module-three has a findbugs XML), actual ' + results.length);
        verifyModuleResult(results, 'module-three', 5, 1, ['main.xml'] /* empty report files are not copied in */);

        done();
    });
    // /* END Tools tests */

});
