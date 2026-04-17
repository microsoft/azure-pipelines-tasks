import assert = require('assert');
import path = require('path');
import os = require('os');

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV1 Suite', function () {
    this.timeout(20000);

    // Use cross-platform temp directory for assertions
    const tempDir = require('os').tmpdir();

    it('Service principal login runs script', async () => {
        const tp = path.join(__dirname, 'L0ServicePrincipalKey.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('/bin/bash /tmp/test.sh arg1 arg2'), 'should run script with args');
        assert(tr.ran('az login --service-principal -u "spId" --password="spKey" --tenant "tenantId"'), 'should login using service principal key');
        assert(tr.ran('az account set --subscription "subId"'), 'should set subscription');
    });

    it('Service principal certificate login runs script', async () => {
        const tp = path.join(__dirname, 'L0ServicePrincipalCertificate.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        const certPath = path.join(tempDir, 'spnCert.pem');
        assert(tr.ran(`az login --service-principal -u "spId" --password="${certPath}" --tenant "tenantId"`), 'should login using service principal certificate');
    });

    it('Inline script uses temp file and sets config dir', async () => {
        const tp = path.join(__dirname, 'L0InlineScriptTempFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        const configDir = path.join(tempDir, '.azclitask');
        assert(tr.stdout.indexOf(`AZURE_CONFIG_DIR=${configDir}`) >= 0, 'should set AZURE_CONFIG_DIR');
    });

    it('Managed identity login runs script', async () => {
        const tp = path.join(__dirname, 'L0ManagedServiceIdentity.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('az login --identity'), 'should login using managed identity');
        assert(tr.ran('/bin/bash /tmp/test.sh'), 'should run script');
    });

    it('Workload identity federation login runs script', async () => {
        const tp = path.join(__dirname, 'L0WorkloadIdentityFederation.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('az login --service-principal -u "spId" --tenant "tenantId" --allow-no-subscriptions --federated-token "federatedToken"'), 'should login using federated token');
    });

    it('Add SPN to environment (service principal) runs script', async () => {
        const tp = path.join(__dirname, 'L0AddSpnToEnvironment_ServicePrincipal.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('/bin/bash /tmp/test.sh'), 'should run script');
    });

    it('Add SPN to environment (workload identity) runs script', async () => {
        const tp = path.join(__dirname, 'L0AddSpnToEnvironment_WorkloadIdentity.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.ran('/bin/bash /tmp/test.sh'), 'should run script');
    });

    if (os.platform() === 'win32') {
        it('Windows scriptPath uses script tool', async () => {
            const tp = path.join(__dirname, 'L0WindowsScriptPath.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

            await tr.runAsync();

            if (!tr.succeeded) {
                console.log('STDOUT:', tr.stdout);
                console.log('STDERR:', tr.stderr);
            }

            assert(tr.succeeded, 'task should have succeeded');
        });
    }

    it('Fails when az login returns error', async () => {
        const tp = path.join(__dirname, 'L0LoginFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
    });

    it('Fails when az --version returns error', async () => {
        const tp = path.join(__dirname, 'L0AzVersionFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
    });

    it('Fails when account set returns error', async () => {
        const tp = path.join(__dirname, 'L0AccountSetFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
    });

    it('Fails on stderr when failOnStandardError is true', async () => {
        const tp = path.join(__dirname, 'L0FailOnStdErr.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.failed, 'task should have failed');
    });

    it('Logout failure does not fail task', async () => {
        const tp = path.join(__dirname, 'L0LogoutFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
    });
});
