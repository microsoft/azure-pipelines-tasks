import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV3 Suite', function () {
    const timeout = 20000;

    before(() => {
    });

    after(() => {
    });

    it('Should handle Azure DevOps connection with Workload Identity Federation', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsWifConnection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            
            assert(tr.stdout.includes('az --version'), 'Should execute az --version command');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should install Azure DevOps extension');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure Azure DevOps organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure Azure DevOps project');
            
            assert(tr.stdout.indexOf('Azure DevOps CLI extension installed') >= 0, 'should install Azure DevOps extension');
            assert(tr.stdout.indexOf('organization configured') >= 0, 'should configure organization');
            assert(tr.stdout.indexOf('project configured') >= 0, 'should configure project');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should fail with unsupported authentication scheme for Azure DevOps', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsUnsupportedAuthScheme.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.indexOf('loc_mock_AuthSchemeNotSupported ServicePrincipal') >= 0, 'Should have failed with unsupported auth scheme error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should skip organization configuration when SYSTEM_COLLECTIONURI is missing', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsMissingOrganization.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure Azure DevOps project');
            assert(tr.stdout.indexOf('project configured') >= 0, 'should configure project');
            assert(!tr.stdout.includes('az devops configure --defaults organization="https://dev.azure.com/testorg/"'), 'Should NOT configure Azure DevOps organization');
            assert(!tr.stdout.includes('az devops configure --defaults organization="undefined"'), 'Should NOT attempt organization config with undefined');
            assert(!tr.stdout.includes('az devops configure --defaults organization="null"'), 'Should NOT attempt organization config with null');
            assert(!tr.stdout.includes('az devops configure --defaults organization=""'), 'Should NOT attempt organization config with empty string');
            assert(!tr.stderr.includes('Code attempted to configure organization'), 'Should not attempt any organization configuration when SYSTEM_COLLECTIONURI is missing');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should skip project configuration when SYSTEM_TEAMPROJECT is missing', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsMissingProject.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure Azure DevOps organization');
            assert(tr.stdout.indexOf('organization configured') >= 0, 'should configure organization');
            assert(!tr.stdout.includes('az devops configure --defaults project="TestProject"'), 'Should NOT configure Azure DevOps project');
            assert(!tr.stdout.includes('az devops configure --defaults project="undefined"'), 'Should NOT attempt project config with undefined');
            assert(!tr.stdout.includes('az devops configure --defaults project="null"'), 'Should NOT attempt project config with null');
            assert(!tr.stdout.includes('az devops configure --defaults project=""'), 'Should NOT attempt project config with empty string');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should skip extension installation when Azure DevOps extension is already installed', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsExtensionAlreadyInstalled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.stdout.includes('az extension show --name azure-devops'), 'Should check if extension is installed');
            assert(!tr.stdout.includes('az extension add -n azure-devops'), 'Should NOT install Azure DevOps extension');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure Azure DevOps organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure Azure DevOps project');
            done();
        }).catch((err) => {
            done(err);
        });
    });
});
