import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as constants from './Constants';
import * as tl from 'azure-pipelines-task-lib';

import * as mt from 'azure-pipelines-task-lib/mock-task';
import * as mtm from 'azure-pipelines-task-lib/mock-test';
import * as mtr from 'azure-pipelines-task-lib/mock-toolrunner';
import * as ma from 'azure-pipelines-task-lib/mock-answer';

describe('PublishTestResults Suite', function() {
    this.timeout(10000);

    before((done) => {
        done();
    });

    beforeEach((done) => {
        // Clear all inputs and other environment variables
        delete process.env[constants.testRunner];
        delete process.env[constants.testResultsFiles];
        delete process.env[constants.mergeTestResults];
        delete process.env[constants.platform];
        delete process.env[constants.configuration];
        delete process.env[constants.testRunTitle];
        delete process.env[constants.publishRunAttachments];
        delete process.env[constants.searchFolder];
        delete process.env[constants.listPackagesReturnCode];
        delete process.env[constants.osType];
        delete process.env[constants.failTaskOnFailedTests];
        delete process.env[constants.failTaskOnFailureToPublishResults];
        delete process.env[constants.allowPtrToDetectTestRunRetryFiles];
        delete process.env['PTR_TEST_FAILURE'];

        done();
    });

    function setCommonRetryDetectionInputs(): void {
        process.env[constants.osType] = 'Ubuntu';
        process.env[constants.testRunner] = 'VSTest';
        process.env[constants.testResultsFiles] = '"n-files0.xml"';
        process.env[constants.mergeTestResults] = 'false';
        process.env[constants.failTaskOnFailedTests] = 'false';
        process.env[constants.platform] = '';
        process.env[constants.configuration] = '';
        process.env[constants.testRunTitle] = '';
        process.env[constants.publishRunAttachments] = 'false';
        process.env[constants.searchFolder] = '';
        process.env[constants.listPackagesReturnCode] = '20000';
        process.env[constants.agentTempDirectory] = __dirname;
        process.env[constants.proxyUrl] = 'http://example.org';
        process.env[constants.proxyUserName] = '1';
        process.env[constants.proxyPassword] = '1';
        process.env[constants.proxyByPassHosts] = undefined;
        process.env[constants.failTaskOnFailureToPublishResults] = 'false';
    }

    function getTelemetryEvents(runner: ttm.MockTestRunner): { [key: string]: any }[] {
        const prefix = '##vso[telemetry.publish area=TestExecution;feature=PublishTestResultsTask]';
        return runner.stdout.split(/\r?\n/)
            .filter(line => line.indexOf(prefix) === 0)
            .map(line => JSON.parse(line.substring(prefix.length)));
    }

    after(function () {
    });

    it('TestResultsPublisher.exe is called on Windows OS', (done: Mocha.Done) => {
        console.log('TestCaseName: TestResultsPublisher.exe is called on Windows OS');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.testRunner] = 'VSTest';
        process.env[constants.testResultsFiles] = '"n-files0.xml"';
        process.env[constants.mergeTestResults] = 'false';
        process.env[constants.failTaskOnFailedTests] = 'false';
        process.env[constants.platform] = '';
        process.env[constants.configuration] = '';
        process.env[constants.testRunTitle] = '';
        process.env[constants.publishRunAttachments] = 'false';
        process.env[constants.searchFolder] = '';
        process.env[constants.listPackagesReturnCode] = '20000';
        process.env[constants.agentTempDirectory] = __dirname;
        process.env[constants.proxyUrl] = "http://example.org";
        process.env[constants.proxyUserName] = "1";
        process.env[constants.proxyPassword] = "1";
        process.env[constants.proxyByPassHosts] = undefined;
        process.env[constants.failTaskOnFailureToPublishResults] = 'false';
        
        // Start the run
        tr.run();
        
        // Asserts
        assert(tr.stdOutContained(`TestResultsPublisher.exe`),
            `TestResultsPublisher.exe should have been called on Windows OS`);
        assert.equal(tr.invokedToolCount, 1, `invoked tool count should be 1`);

        done();
    });

    it('TestResultsPublisher.exe is not called on non-Windows OS', (done: Mocha.Done) => {
        console.log('TestCaseName: TestResultsPublisher.exe is not called on non-Windows OS');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.osType] = 'Ubuntu';
        process.env[constants.testRunner] = 'VSTest';
        process.env[constants.testResultsFiles] = '"n-files0.xml"';
        process.env[constants.mergeTestResults] = 'false';
        process.env[constants.failTaskOnFailedTests] = 'false';
        process.env[constants.platform] = '';
        process.env[constants.configuration] = '';
        process.env[constants.testRunTitle] = '';
        process.env[constants.publishRunAttachments] = 'false';
        process.env[constants.searchFolder] = '';
        process.env[constants.listPackagesReturnCode] = '20000';
        process.env[constants.agentTempDirectory] = __dirname;        
        process.env[constants.proxyUrl] = "http://example.org";
        process.env[constants.proxyUserName] = "1";
        process.env[constants.proxyPassword] = "1";
        process.env[constants.proxyByPassHosts] = undefined;
        process.env[constants.failTaskOnFailureToPublishResults] = 'false';

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stdout.indexOf(`TestResultsPublisher.exe`) < 0,
            `TestResultsPublisher.exe should not have been called on non-windows OS`);
        assert.equal(tr.invokedToolCount, 0, `invoked tool count should be 0`);
        const stages = getTelemetryEvents(tr).map(event => event.stage);
        assert(stages.indexOf('ResultsPublishCommandRequested') >= 0);
        assert(stages.indexOf('NativePublisherLaunchRequested') < 0);

        done();
    });

    it('Command should be called when exe returns with exit code for feature flag off', (done: Mocha.Done) => {
        console.log('TestCaseName: Command should be called when exe returns with exit code for feature flag off');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.testRunner] = 'VSTest';
        process.env[constants.testResultsFiles] = '"n-files0.xml"';
        process.env[constants.mergeTestResults] = 'false';
        process.env[constants.failTaskOnFailedTests] = 'false';
        process.env[constants.platform] = '';
        process.env[constants.configuration] = '';
        process.env[constants.testRunTitle] = '';
        process.env[constants.publishRunAttachments] = 'false';
        process.env[constants.searchFolder] = '';
        process.env[constants.listPackagesReturnCode] = '20000';
        process.env[constants.agentTempDirectory] = __dirname;
        process.env[constants.proxyUrl] = "http://example.org";
        process.env[constants.proxyUserName] = "1";
        process.env[constants.proxyPassword] = "1";
        process.env[constants.proxyByPassHosts] = undefined;
        process.env[constants.failTaskOnFailureToPublishResults] = 'false';

        // Start the run
        tr.run();
        
        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert.equal(tr.invokedToolCount, 1, `invoked tool count should be 1`);
        assert(tr.stdOutContained(`TestResultsPublisher.exe`),
            `Should have called TestResultsPublisher.exe first`);
        assert(tr.stdOutContained(`vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=false;resultFiles=n-files0.xml;failTaskOnFailedTests=false;failTaskOnFailureToPublishResults=false;testRunSystem=VSTS - PTR;]`),
            `Should have published results through Command when feature flag is off`);
        const stages = getTelemetryEvents(tr).filter(event => event.stage);
        const returned = stages.findIndex(event => event.stage === 'NativePublisherReturned');
        const fallback = stages.findIndex(event => event.stage === 'ResultsPublishCommandRequested');
        assert.equal(stages[returned].exitCode, 20000);
        assert(fallback > returned, 'Fallback telemetry should follow the native return');

        done();
    });

    it('Command should not be called when exe returns with exit code for feature flag on', (done: Mocha.Done) => {
        console.log('TestCaseName: Command should not be called when exe returns with exit code for feature flag on');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.testRunner] = 'VSTest';
        process.env[constants.testResultsFiles] = '"n-files0.xml"';
        process.env[constants.mergeTestResults] = 'false';
        process.env[constants.failTaskOnFailedTests] = 'false';
        process.env[constants.platform] = '';
        process.env[constants.configuration] = '';
        process.env[constants.testRunTitle] = '';
        process.env[constants.publishRunAttachments] = 'false';
        process.env[constants.searchFolder] = '';
        process.env[constants.listPackagesReturnCode] = '0';
        process.env[constants.agentTempDirectory] = __dirname;
        process.env[constants.proxyUrl] = "http://example.org";
        process.env[constants.proxyUserName] = "1";
        process.env[constants.proxyPassword] = "1";
        process.env[constants.proxyByPassHosts] = undefined;
        process.env[constants.failTaskOnFailureToPublishResults] = 'false';

        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert.equal(tr.invokedToolCount, 1, `invoked tool count should be 1`);
        assert(tr.stdOutContained(`TestResultsPublisher.exe`),
            `Should have called TestResultsPublisher.exe first`);
        assert(tr.stdout.indexOf(`vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=false;resultFiles=n-files0.xml;failTaskOnFailedTests=false;failTaskOnFailureToPublishResults=false;testRunSystem=VSTS - PTR;]`) < 0,
            `Command should not have been called when exe returns with exit code suggesting feature flag is on`);

        done();
    });

    it('Command should include retry-detection property when allowPtrToDetectTestRunRetryFiles is true', (done: Mocha.Done) => {
        console.log('TestCaseName: Command should include retry-detection property when allowPtrToDetectTestRunRetryFiles is true');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        setCommonRetryDetectionInputs();
        process.env[constants.allowPtrToDetectTestRunRetryFiles] = 'true';

        tr.run();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdOutContained('isDetectTestRunRetry=true;'), 'Publish command should include retry-detection property when variable is true');

        done();
    });

    it('Command should not include retry-detection property when allowPtrToDetectTestRunRetryFiles is false', (done: Mocha.Done) => {
        console.log('TestCaseName: Command should not include retry-detection property when allowPtrToDetectTestRunRetryFiles is false');

        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        setCommonRetryDetectionInputs();
        process.env[constants.allowPtrToDetectTestRunRetryFiles] = 'false';

        tr.run();

        assert(tr.succeeded, 'Task should have succeeded');
        assert(tr.stdout.indexOf('isDetectTestRunRetry=true;') < 0, 'Publish command should not include retry-detection property when variable is false');

        done();
    });

    it('Correlates ordered native-publisher milestones and consolidated telemetry per invocation', () => {
        setCommonRetryDetectionInputs();
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.listPackagesReturnCode] = '0';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.succeeded);
        const events = getTelemetryEvents(runner);
        const stages = events.filter(event => event.subFeature === 'publishTestResultsTaskStageEvent');
        assert.deepEqual(stages.map(event => event.stage), [
            'TaskStarted', 'InputsRead', 'FindingResultFiles', 'ResultFilesFound',
            'CheckingDotNetTelemetryFeatureFlag', 'GettingDotNetVersion', 'DotNetVersionRead',
            'NativePublisherPreparing', 'NativePublisherLaunchRequested', 'NativePublisherReturned', 'TaskCompleted'
        ]);
        stages.forEach((event, index) => {
            assert.equal(event.sequence, index + 1);
            assert.equal(event.previousStage, index > 0 ? stages[index - 1].stage : undefined);
            assert(event.elapsedTimeMs >= (index > 0 ? stages[index - 1].elapsedTimeMs : 0));
        });
        events.forEach(event => {
            assert.equal(event.invocationId, stages[0].invocationId);
            assert.equal(event.buildid, '12345');
            assert.equal(event.planId, 'test-plan');
            assert.equal(event.jobId, 'test-job');
            assert.equal(event.taskInstanceId, 'test-task');
            assert.equal(event.jobAttempt, '1');
            assert(event.processId > 0);
            assert(event.nodeVersion);
            assert(event.nodeArchitecture);
        });
        const consolidated = events.find(event => event.subFeature === 'publishTestResultsTaskConsolidatedCiEvent');
        assert(consolidated, 'Existing consolidated telemetry must still be emitted');
        assert.equal(consolidated.lastStage, 'TaskCompleted');

        const nextRunner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        nextRunner.run();
        assert.notEqual(getTelemetryEvents(nextRunner)[0].invocationId, stages[0].invocationId);
    });

    it('Reports the failing discovery stage without including exception text in telemetry', () => {
        setCommonRetryDetectionInputs();
        process.env['PTR_TEST_FAILURE'] = 'find';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.failed);
        const events = getTelemetryEvents(runner);
        const failure = events.find(event => event.stage === 'TaskException');
        assert.equal(failure.previousStage, 'FindingResultFiles');
        assert.equal(failure.exceptionType, 'Error');
        assert(JSON.stringify(events).indexOf('mock-secret') < 0);
        const consolidated = events.find(event => event.subFeature === 'publishTestResultsTaskConsolidatedCiEvent');
        assert.equal(consolidated.lastStage, 'TaskException');
        assert.equal(consolidated.previousStage, 'FindingResultFiles');
        assert.equal(runner.invokedToolCount, 0);
    });

    it('Reports a rejected native invocation without recording a native return', () => {
        setCommonRetryDetectionInputs();
        process.env[constants.osType] = 'Windows_NT';
        process.env['PTR_TEST_FAILURE'] = 'publisher';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.failed);
        const events = getTelemetryEvents(runner);
        const failure = events.find(event => event.stage === 'TaskException');
        assert.equal(failure.previousStage, 'NativePublisherLaunchRequested');
        assert.equal(failure.exceptionType, 'Error');
        assert(!events.some(event => event.stage === 'NativePublisherReturned'));
        assert(JSON.stringify(events).indexOf('mock-secret') < 0);
    });

    it('Records a native failed-tests exit without changing task failure handling', () => {
        setCommonRetryDetectionInputs();
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.listPackagesReturnCode] = '40000';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.failed);
        const events = getTelemetryEvents(runner);
        assert.equal(events.find(event => event.stage === 'NativePublisherReturned').exitCode, 40000);
        assert(!events.some(event => event.stage === 'TaskException'));
        assert(events.some(event => event.stage === 'TaskCompleted'));
    });

    it('Reports response-file failure while preserving command fallback', () => {
        setCommonRetryDetectionInputs();
        process.env[constants.osType] = 'Windows_NT';
        process.env[constants.agentTempDirectory] = path.join(__dirname, 'missing-telemetry-directory');
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.succeeded);
        const stages = getTelemetryEvents(runner).filter(event => event.stage);
        const failure = stages.findIndex(event => event.stage === 'ResponseFileCreationFailed');
        assert(failure >= 0);
        assert.equal(stages[failure].previousStage, 'NativePublisherPreparing');
        assert(stages.findIndex(event => event.stage === 'ResultsPublishCommandRequested') > failure);
        assert(!stages.some(event => event.stage === 'NativePublisherLaunchRequested'));
        assert.equal(runner.invokedToolCount, 0);
    });

    it('Does not fail publishing when telemetry output throws', () => {
        setCommonRetryDetectionInputs();
        process.env['PTR_TEST_FAILURE'] = 'telemetry';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        runner.run();

        assert(runner.succeeded);
        assert(runner.stdOutContained('##vso[results.publish '));
        assert.equal(getTelemetryEvents(runner).length, 0);
        assert.equal(runner.errorIssues.length, 0);
    });
});