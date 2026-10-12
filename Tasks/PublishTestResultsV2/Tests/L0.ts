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

    after(function () {
    });

    ['Windows_NT', 'Linux', 'Darwin'].forEach((osType) => {
        it(`Publishes results without probing the .NET SDK on ${osType}`, (done: Mocha.Done) => {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
            setCommonRetryDetectionInputs();
            process.env[constants.osType] = osType;

            tr.run();

            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('##vso[results.publish '), 'Results should still be published');
            assert.equal(tr.invokedToolCount, osType === 'Windows_NT' ? 1 : 0,
                'Only the Windows test results publisher should invoke a tool');
            assert(!tr.stdOutContained('dotnet --version'), 'The SDK version probe should not run');
            assert(tr.stdOutContained('##vso[telemetry.publish '), 'Other telemetry should still be published');
            assert(!tr.stdOutContained('"dotnetVersion"'), 'SDK version telemetry should be omitted');

            done();
        });
    });

    it('Does not probe the .NET SDK when no result files match', (done: Mocha.Done) => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
        setCommonRetryDetectionInputs();
        process.env[constants.testResultsFiles] = '"missing-results.xml"';

        tr.run();

        assert(tr.succeeded, 'Missing results should remain a warning by default');
        assert.equal(tr.warningIssues.length, 1, 'Missing results should produce a warning');
        assert.equal(tr.invokedToolCount, 0, 'No tools should be invoked without result files');
        assert(!tr.stdOutContained('##vso[results.publish '), 'No results should be published');
        assert(!tr.stdOutContained('"dotnetVersion"'), 'SDK version telemetry should be omitted');

        done();
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
});