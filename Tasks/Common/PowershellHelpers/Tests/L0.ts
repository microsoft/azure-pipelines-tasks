import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('PowershellHelpers Suite', function () {
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

    if (psm.testSupported()) {
        it('(Invoke-ActionWithRetries) should try on action failure', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldRetryOnException.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should honor max retries count parameter', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldHonorMaxRetriesParameter.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should not retry action if it is successful', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldNotRetrySuccess.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should not handle retryable exception', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldRetryAssignableException.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should stop retry once success', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldRetryUntilSuccess.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should return result if action is successful', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldReturnResultIfItIsSuccessfull.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should throw if result does not evaluate to success', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldThrowIfResultNotSuccessfull.ps1'), done);
        })
        it('(Invoke-ActionWithRetries) should handle multiple retryable exceptions', (done) => {
            psr.run(path.join(__dirname, 'Invoke-ActionWithRetries.ShouldHandleMultipleRetryableExceptions.ps1'), done);
        })
        it('(Get-TempDirectoryPath) get temp directory', (done) => {
            psr.run(path.join(__dirname, 'Get-TempDirectoryPath.ps1'), done);
        })
    }
});