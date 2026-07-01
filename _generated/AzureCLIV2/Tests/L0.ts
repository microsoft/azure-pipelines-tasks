import assert = require('assert');
import path = require('path');

import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { runValidateScriptArgsTests } from './L0ValidateScriptArgs';
import { runTryValidateScriptArgsTests } from './L0TryValidateScriptArgs';
import { runConfigDirIsolationTests } from './L0ConfigDirIsolation';

describe('AzureCLIV2 Suite', function () {
    this.timeout(30000);

    describe('Script args sanitizer (AZP_75787_*)', () => {
        runValidateScriptArgsTests();
    });

    describe('Args validation feature flag (EnableAzureCliArgsValidation)', () => {
        runTryValidateScriptArgsTests();
    });

    describe('AZURE_CONFIG_DIR isolation', () => {
        runConfigDirIsolationTests();
    });

    it('LateBoundIdToken: Feature Flag ON, Token Present -> Uses Token, Emits Telemetry', async () => {
        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOn_TokenPresent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, LateBoundIdToken, {"connectedService":"AzureRM","idTokenPresent":"true"}') >= 0, 'should emit telemetry with idTokenPresent=true');
        assert(tr.stdout.indexOf('Using bound idToken from service endpoint.') >= 0, 'should log that it is using bound idToken');
        assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') === -1, 'should NOT call createOidcToken');
    });

    it('LateBoundIdToken: Feature Flag ON, Token Missing -> Calls API, Emits Telemetry', async () => {
        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOn_TokenMissing.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, LateBoundIdToken, {"connectedService":"AzureRM","idTokenPresent":"false"}') >= 0, 'should emit telemetry with idTokenPresent=false');
        assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') >= 0, 'should call createOidcToken');
    });

    it('LateBoundIdToken: Feature Flag OFF -> Calls API, No Telemetry', async () => {
        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOff.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, LateBoundIdToken') === -1, 'should NOT emit LateBoundIdToken telemetry');
        assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') >= 0, 'should call createOidcToken');
    });

    it('Service Principal Authentication: Login with service principal key', async () => {
        let tp = path.join(__dirname, 'ServicePrincipalCertificate_Login.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with service principal authentication');
    });

    it('Managed Service Identity: Login with MSI authentication', async () => {
        let tp = path.join(__dirname, 'ManagedServiceIdentity_Login.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with MSI authentication');
    });

    it('Add SPN to Environment: Service Principal credentials passed to script', async () => {
        let tp = path.join(__dirname, 'AddSpnToEnvironment_ServicePrincipal.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('SPN_ENVIRONMENT_VARIABLES_PRESENT') >= 0, 'should pass SPN credentials to script environment');
    });

    it('Fail on Standard Error: Task fails when stderr is produced', async () => {
        let tp = path.join(__dirname, 'FailOnStandardError_StderrPresent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(!tr.succeeded, 'task should have failed due to stderr output');
    });

    it('Az Version Parsing: Handles JSON format output (UseAzVersion enabled)', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_JsonFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with JSON format az version output');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
    });

    it('Az Version Parsing: Handles table format output (UseAzVersion enabled)', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_TableFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with table format az version output');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
    });

    it('Az Version Parsing: Handles text format output (UseAzVersion enabled)', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_TextFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with text format az version output');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
    });

    it('Az Version Parsing: Older version (< 2.66.0) is correctly parsed and compared', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_OlderVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with older az version');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.50.0') >= 0, 'should correctly extract version 2.50.0');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
    });

    it('Az Version Parsing: Handles TSV format output (UseAzVersion enabled)', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_TsvFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with TSV format az version output');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
    });

    it('Az Version Parsing: Handles YAML format output (UseAzVersion enabled)', async () => {
        let tp = path.join(__dirname, 'AzVersionParse_YamlFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with YAML format az version output');
        assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
        assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
    });

    it('Keep Azure Session Active: Refresh token for WIF with keepAzSessionActive enabled', async () => {
        let tp = path.join(__dirname, 'KeepAzSessionActive_WIF.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with session refresh enabled');
        assert(tr.stdout.indexOf('IDTOKEN_ENV_VARIABLE_PRESENT') >= 0, 'should pass idToken to script environment');
    });

    it('Windows PS/PSCore: File invocation with caret in password (AZP_AZURECLI_USE_FILE_INVOCATION flag)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationWithCaretPassword.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with -File invocation and caret password preserved');
        assert(tr.stdout.indexOf('Using -File invocation for PowerShell Core to avoid CMD metacharacter issues') >= 0, 'should log -File invocation usage');
    });

    it('File invocation: Task fails on non-zero exit code (pscore, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationNonZeroExit_pscore.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to non-zero exit code');
    });

    it('File invocation: Task fails on non-zero exit code (ps, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationNonZeroExit_ps.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to non-zero exit code');
    });

    it('File invocation: Task fails on terminating error (pscore, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationTerminatingError_pscore.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to terminating error');
    });

    it('File invocation: Task fails on terminating error (ps, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationTerminatingError_ps.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to terminating error');
    });

    it('File invocation: Task fails on stderr with failOnStandardError=true (pscore, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationStderrFailOnStdErr_pscore.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to stderr with failOnStandardError=true');
    });

    it('File invocation: Task fails on stderr with failOnStandardError=true (ps, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationStderrFailOnStdErr_ps.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(!tr.succeeded, 'task should have failed due to stderr with failOnStandardError=true');
    });

    it('Az function alias injection: injects function when FF on + az found + python.exe exists', async () => {
        let tp = path.join(__dirname, 'L0AzFunctionAliasInjection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('Injected PowerShell az function alias to bypass az.cmd.') >= 0, 'should log az function alias injection');
        assert(tr.stdout.indexOf('function az {') >= 0, 'generated script should contain az function alias');
        assert(tr.stdout.indexOf('python.exe') >= 0, 'generated script should reference python.exe');
        assert(tr.stdout.indexOf('-IBm azure.cli') >= 0, 'generated script should invoke azure.cli module');
    });

    it('Az function alias injection: does NOT inject when FF is off', async () => {
        let tp = path.join(__dirname, 'L0AzFunctionAliasNoInjection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('function az {') === -1, 'generated script should NOT contain az function alias when FF is off');
    });
});
