import assert = require('assert');
import path = require('path');

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV2 Suite', function () {
    this.timeout(30000);

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
