/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { isPowerShellArgumentAstSafe } from 'azure-pipelines-tasks-args-sanitizer/argsSanitizer';
import tl = require('azure-pipelines-task-lib/task');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;
const taskVersion = require('../task.json').version;
const expectedTaskVersion = `${taskVersion.Major}.${taskVersion.Minor}.${taskVersion.Patch}`;

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
        /*it('checks for powershell', (done) => {
            psr.run(path.join(__dirname, 'ChecksForPowerShell.ps1'), done);
        })*/
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
        it('cleans up temp script after execution in pwsh mode', (done) => {
            psr.run(path.join(__dirname, 'CleansUpTempScriptPwsh.ps1'), done);
        })
    }

    it('deletes the generated temporary script after execution', async () => {
        let tp = path.join(__dirname, 'L0Cleanup_DeletesTempScript.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should succeed');
        assert(tr.stdout.indexOf('TEMP_SCRIPT_REMOVED') >= 0,
            'generated temporary script should be deleted');
        assert(tr.stdout.indexOf(`DELETE_TELEMETRY:DeleteSucceeded:${expectedTaskVersion}:`) >= 0,
            'delete-success telemetry should include the generated task version');
    });

    it('does not delete the temporary script when the feature is disabled', async () => {
        let tp = path.join(__dirname, 'L0Cleanup_FeatureDisabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should succeed');
        assert(tr.stdout.indexOf('TEMP_SCRIPT_REMOVED') < 0,
            'generated temporary script should not be deleted while the feature is disabled');
    });

    it('fails cleanly when writing the temporary script fails', async () => {
        let tp = path.join(__dirname, 'L0Cleanup_WriteFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should fail when the temporary script cannot be written');
        assert(tr.stdout.indexOf('simulated write failure') >= 0,
            'the write failure should be reported');
        assert(tr.invokedToolCount === 0,
            'PowerShell must not run when writing the temporary script fails');
    });

    it('continues safely and emits path-safe telemetry when deletion fails', async () => {
        let tp = path.join(__dirname, 'L0Cleanup_DeleteFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should succeed when temporary script deletion fails');
        assert(tr.stdout.indexOf('Failed to delete the temporary Azure PowerShell script. Error code: EACCES.') >= 0,
            'the deletion warning should include only the error code');
        assert(tr.stdout.indexOf('/sensitive/delete/path.ps1') < 0,
            'the deletion warning should not include the error message or path');
        assert(tr.stdout.indexOf(`DELETE_TELEMETRY:DeleteFailed:${expectedTaskVersion}:EACCES`) >= 0,
            'delete-failure telemetry should include the task version and error code');
    });

    it('escapes single quotes in endpoint data before generating the PowerShell script', async () => {
        let tp = path.join(__dirname, 'L0EndpointSingleQuoteEscaping.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should succeed with a single quote in endpoint data');
        assert(tr.stdout.indexOf('ENDPOINT_SINGLE_QUOTE_ESCAPED') >= 0,
            'the generated script should escape endpoint single quotes for PowerShell');
    });

    describe('MSRC 129198: Node handler rejects newline in ScriptArguments', function () {
        it('allows ignored multiline ScriptArguments for InlineScript', async () => {
            let tp = path.join(__dirname, 'L0NodeInlineIgnoresScriptArguments.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert(tr.stdout.indexOf('InvalidScriptArguments0') < 0,
                'ignored InlineScript arguments must not be validated');
            assert(tr.stdout.indexOf('Endpoint auth data not present') >= 0,
                'task must proceed past input validation');
        });

        it('allows data-only constructors and rejects evaluated constructor expressions', () => {
            // The benign-PASS case needs a real PowerShell to exit 0; skip it where no interpreter exists
            // (e.g. a pwsh-less macOS agent). The fail-closed negatives below are interpreter-independent.
            if (tl.which('pwsh', false) || tl.which('powershell', false)) {
                assert(isPowerShellArgumentAstSafe('-Tags @{ env = "prod"; port = 8080 }'));
            }
            assert(!isPowerShellArgumentAstSafe('@{ k = New-Item -Path C:\\evil.txt -ItemType File -Force }'));
            assert(!isPowerShellArgumentAstSafe('@{ k = [System.Net.Dns]::MachineName }'));
            assert(!isPowerShellArgumentAstSafe('@{ k = New-Item C:\\evil }', 'pwsh-does-not-exist-xyz'));
        });

        it('rejects a newline in ScriptArguments before the dot-source sink', async () => {
            let tp = path.join(__dirname, 'L0NodeRejectsNewline.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            if (tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
            }
            assert(!tr.succeeded, 'task must fail on a newline in ScriptArguments');
            assert(tr.stdout.indexOf('InvalidScriptArguments0') >= 0,
                'should fail with the InvalidScriptArguments0 loc key (Line breaks are not allowed)');
        });

        it('blocks a ; statement separator in ScriptArguments when the sanitizer FFs are on', async () => {
            let tp = path.join(__dirname, 'L0NodeSanitizesArgs.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            if (tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
            }
            assert(!tr.succeeded, 'task must fail on a ; statement separator under enforce');
            assert(tr.stdout.indexOf('ScriptArgsSanitized') >= 0,
                'should fail with the ScriptArgsSanitized loc key');
        });

        it('blocks a data-constructor command expression when the expression FF and enforce toggle are on', async () => {
            let tp = path.join(__dirname, 'L0NodeBlocksExpression.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            if (tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
            }
            assert(!tr.succeeded, 'task must fail on a command-valued hashtable under enforce + expression FF');
            assert(tr.stdout.indexOf('ScriptArgsSanitized') >= 0,
                'should fail with the ScriptArgsSanitized loc key');
        });

        it('does not block a ; statement separator when the sanitizer FFs are off (no-op)', async () => {
            let tp = path.join(__dirname, 'L0NodeSanitizerNoopWhenOff.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert(tr.stdout.indexOf('ScriptArgsSanitized') < 0,
                'sanitizer must be a no-op when the feature flags are off');
            assert(tr.stdout.indexOf('Endpoint auth data not present') >= 0,
                'task must proceed past the sanitizer to endpoint acquisition (proves pass-through, not an early failure)');
        });

        it('does not block under the on-everywhere sanitization master + enforce when the new ring FFs are off (dark-deploy parity)', async () => {
            let tp = path.join(__dirname, 'L0NodeOuterGateOffInnerOn.js');
            let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();
            assert(tr.stdout.indexOf('ScriptArgsSanitized') < 0,
                'the new rejection must require the EnableScriptArgumentsExpressionValidation ring, not just the already-on master');
            assert(tr.stdout.indexOf('Endpoint auth data not present') >= 0,
                'task must proceed past the sanitizer (proves no new blocking on deploy from the on-everywhere master)');
        });
    });
});