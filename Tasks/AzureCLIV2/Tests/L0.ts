import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV2 Suite', function () {
    this.timeout(10000);

    before(() => {
    });

    after(() => {
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
});
