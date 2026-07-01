/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzurePowerShell Suite', function () {
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
        it('checks for powershell core', (done) => {
            psr.run(path.join(__dirname, 'ChecksForPowerShellCore.ps1'), done);
        })
        it('checks for powershell', (done) => {
            psr.run(path.join(__dirname, 'ChecksForPowerShell.ps1'), done);
        })
        it('checks for working directory', (done) => {
            psr.run(path.join(__dirname, 'ChecksForWorkingDirectory.ps1'), done);
        })
        it('performs basic flow', (done) => {
            psr.run(path.join(__dirname, 'PerformsBasicFlow.ps1'), done);
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
        it('Get-LatestModule returns the latest available module', (done) => {
            psr.run(path.join(__dirname, 'Utility.Get-LatestModule.ps1'), done);
        })
        it('Update-PSModulePathForHostedAgent updated psmodulepath correctly', (done) => {
            psr.run(path.join(__dirname, 'Utility.UpdatePSModulePathForHostedAgentWorksCorrectly.ps1'), done);
        })
        it('does not leak access token into generated script', (done) => {
            psr.run(path.join(__dirname, 'TokenNotLeakedToScript.ps1'), done);
        })
        it('cleans up temp script after execution', (done) => {
            psr.run(path.join(__dirname, 'CleansUpTempScript.ps1'), done);
        })
        it('clears access token env var after execution', (done) => {
            psr.run(path.join(__dirname, 'ClearsTokenEnvVar.ps1'), done);
        })
    }

    describe('Cleanup is best-effort: never overrides task result', function () {

        it('cleanup script fails: task still succeeds with a warning', async () => {
            let tp = path.join(__dirname, 'L0Cleanup_CleanupFailsWarnsButTaskSucceeds.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            if (!tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
                console.log('STDERR:', tr.stderr);
            }

            assert(tr.succeeded, 'task should have succeeded since main script passed; cleanup must not override the result');
            assert(tr.stdout.indexOf('Azure context cleanup completed with exit code: 1') >= 0,
                'should emit warning about cleanup failure');
            // Cleanup failure must NOT produce a Failed setResult
            assert(tr.stdout.indexOf('Cleanup failed with exit code:') < 0,
                'should NOT emit the old "Cleanup failed with exit code:" Failed result');
        });

        it('pwsh not found: task fails with original error, cleanup is skipped', async () => {
            let tp = path.join(__dirname, 'L0Cleanup_PwshNotFound.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(!tr.succeeded, 'task should have failed because pwsh is not available');
            // The original error from tl.which(x, true) must be preserved — cleanup must
            // not throw on its own and overwrite it.
            assert(tr.stdout.indexOf('Skipping cleanup') >= 0 || tr.stdout.indexOf('Unable to locate') >= 0,
                'should either skip cleanup or surface the original pwsh-not-found error');
            assert(tr.stdout.indexOf('Cleanup failed with error message:') < 0,
                'should NOT emit the old "Cleanup failed with error message:" Failed result');
        });

        it('cleanup throws: task still succeeds with a warning and env vars are cleared', async () => {
            // Regression for the env-clear gate: when await powershell.exec() rejects,
            // cleanupExitCode stays 0 (never assigned) but cleanupOutcome becomes 'Threw'.
            // The gate must key off cleanupOutcome, otherwise AZURESUBSCRIPTION_* would leak.
            let tp = path.join(__dirname, 'L0Cleanup_CleanupThrowsWarnsButTaskSucceeds.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            if (!tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
                console.log('STDERR:', tr.stderr);
            }

            assert(tr.succeeded, 'task should have succeeded since main script passed; cleanup throwing must not override the result');
            assert(tr.stdout.indexOf('Azure context cleanup failed:') >= 0,
                'should emit the catch-branch warning about cleanup throwing');
            // Old setResult(Failed,...) marker must not be present
            assert(tr.stdout.indexOf('Cleanup failed with error message:') < 0,
                'should NOT emit the old "Cleanup failed with error message:" Failed result');
            assert(tr.stdout.indexOf('Cleanup failed with exit code:') < 0,
                'should NOT emit the old "Cleanup failed with exit code:" Failed result');
            // The Threw branch must take the env-clear path (debug line covers all
            // non-Success outcomes after the gate fix).
            assert(tr.stdout.indexOf('Clearing service connection environment variables from agent process.') >= 0,
                'env-clear gate must fire for the Threw branch (regression: was skipped when cleanupExitCode stayed 0)');
        });
    });
});