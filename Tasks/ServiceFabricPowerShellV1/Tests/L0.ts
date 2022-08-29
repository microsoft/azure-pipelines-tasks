import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('ServiceFabricPowerShell Suite', function () {
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
        it('removes functions and variables', (done) => {
            psr.run(path.join(__dirname, 'RemovesFunctionsAndVariables.ps1'), done);
        })
        it('throws when invalid script arguments', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptArguments.ps1'), done);
        })
        it('throws when invalid script path', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptPath.ps1'), done);
        })
    }
});