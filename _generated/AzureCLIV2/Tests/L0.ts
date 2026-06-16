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
});
