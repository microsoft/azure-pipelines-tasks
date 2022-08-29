import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('AzurePowerShell Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        // process.env['TASK_TEST_TRACE'] = 1;
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
        it('does not unravel output', (done) => {
            psr.run(path.join(__dirname, 'DoesNotUnravelOutput.ps1'), done);
        })
        it('performs basic flow', (done) => {
            psr.run(path.join(__dirname, 'PerformsBasicFlow.ps1'), done);
        })
        it('validates inline script flow', (done) => {
            psr.run(path.join(__dirname, 'ValidateInlineScriptFlow.ps1'), done);
        })
        it('redirects errors', (done) => {
            psr.run(path.join(__dirname, 'RedirectsErrors.ps1'), done);
        })
        it('does not fail if failonstandarderror is set to false', (done) => {
            psr.run(path.join(__dirname, 'DoesNotFailOnStandardError.ps1'), done);
        })
        it('removes functions and variables', (done) => {
            psr.run(path.join(__dirname, 'RemovesFunctionsAndVariables.ps1'), done);
        })
        it('throws when otherversion is specified in a wrong format', (done) => {
            psr.run(path.join(__dirname, 'ThrowsForInvalidVersion.ps1'), done);
        })
        it('throws when invalid script arguments', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptArguments.ps1'), done);
        })
        it('throws when invalid script path', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptPath.ps1'), done);
        })
        it('does not fail if native command writes to stderr and failonstderr is false', (done) => {
            psr.run(path.join(__dirname, 'DoesNotThrowForNativeCommandError.ps1'), done);
        })
        it('fails for native command error if fail on standard error is true', (done) => {
            psr.run(path.join(__dirname, 'FailsForNativeCommandError.ps1'), done);
        })
        it('Get-LatestModule returns the latest available module', (done) => {
            psr.run(path.join(__dirname, 'Utility.Get-LatestModule.ps1'), done);
        })
        it('Update-PSModulePathForHostedAgent updated psmodulepath correctly', (done) => {
            psr.run(path.join(__dirname, 'Utility.UpdatePSModulePathForHostedAgentWorksCorrectly.ps1'), done);
        })
    }
});