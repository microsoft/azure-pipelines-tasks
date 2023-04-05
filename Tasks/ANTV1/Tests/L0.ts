import assert = require('assert');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import path = require('path');
import os = require('os');

var isWindows = os.type().match(/^Win/);

describe('ANT Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('run ANT with all inputs', (done) => {
        const testPath = path.join(__dirname, 'L0AllInputs.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
        done();
    })

    it('fails if missing antBuildFile input', (done) => {
        const testPath = path.join(__dirname, 'L0MissingAntBuildFile.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: antBuildFile'), 'wrong error message');
        done();
    })

    it('fails if missing javaHomeSelection input', (done) => {
        const testPath = path.join(__dirname, 'L0MissingJavaHomeSelection.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: javaHomeSelection'), 'wrong error message"');
        done();
    })

    it('fails if missing testResultsFiles input', (done) => {
        const testPath = path.join(__dirname, 'L0MissingTestResultsFiles.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: testResultsFiles'), 'wrong error message:"');
        done();
    })

    it('run ANT with antHomeUserInputPath', (done) => {
        const testPath = path.join(__dirname, 'L0RunWithAntHomeUserInputPath.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('Set ANT_HOME to /usr/local/bin/ANT2'), 'ANT_HOME not set correctly');
        done();
    })

    it('run ANT with antHomeUserInputPath set to invalid path', (done) => {
        const testPath = path.join(__dirname, 'L0InvalidUserHomePath.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Not found /usr/local/bin/ANT_invalid'), 'Invalid path not detected');
        done();
    })

    it('run ANT with ANT_HOME not set', (done) => {
        const testPath = path.join(__dirname, 'L0AntHomeNotSet.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.invokedToolCount == 1, 'should have only run ANT once');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('The ANT_HOME environment variable is not set'), 'Missing JAVA_HOME not detected');
        done();
    })

    it('run ANT with jdkVersion set to 1.8', (done) => {
        const testPath = path.join(__dirname, 'L0JDKSetTo8.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();
        
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert.strictEqual(runner.invokedToolCount, 2, 'should have run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('Set JAVA_HOME to /user/local/bin/ANT8'), 'JAVA_HOME not set correctly');
        done();
    })

    it('run ANT with jdkVersion set to 1.5', (done) => {
        const testPath = path.join(__dirname, 'L0JDKSetTo5.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        if (isWindows) {
            assert.strictEqual(runner.invokedToolCount, 1, 'should have run the reg query toolrunner');
        } else {
            assert.strictEqual(runner.invokedToolCount, 0, 'should not have run tools');
        }
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('FailedToLocateSpecifiedJVM'), 'Should write FailedToLocateSpecifiedJVM error');
        done();
    })

    it('run ANT valid inputs but it fails', (done) => {
        const testPath = path.join(__dirname, 'L0FailWithValidInputs.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.failed, 'task should have failed');
        done();
    })

    it('Ant build with Publish Test Results.', (done) => {
        const testPath = path.join(__dirname, 'L0PublishTestResults.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.succeeded, 'The task should not have failed');
        assert(runner.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0)
        done();
    })

    it('Ant build with Publish Test Results with no matching test result files.', (done) => {
        const testPath = path.join(__dirname, 'L0NoMatchingTestResults.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.stdout.search(/##vso\[results.publish\]/) < 0, 'publish test results should have not got called.');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.stdOutContained('NoTestResults'), 'should have warned about lack of test results');
        assert(runner.succeeded, 'task should have succeeded');
        done();
    })

    it('Ant build with Publish Test Results for failed builds.', (done) => {
        const testPath = path.join(__dirname, 'L0FailedBuilds.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        runner.run();

        assert(runner.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0);
        done();
    })
});
