import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV3 Suite', function () {
    const timeout = 30000;

    before(() => {
    });

    after(() => {
    });

    it('Should handle Azure DevOps connection with Workload Identity Federation', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsWifConnection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.stdout.includes('az version') || tr.stdout.includes('az --version'), 'Should execute az version command');
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
            assert(tr.stdout.indexOf('loc_mock_AuthSchemeNotSupportedForAzureDevOps ServicePrincipal') >= 0, 'Should have failed with unsupported auth scheme error');
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
            assert(tr.stdout.includes('Azure DevOps extension is already installed, skipping installation'), 'Should check if extension is installed and skip installation');
            assert(!tr.stdout.includes('az extension add -n azure-devops'), 'Should NOT install Azure DevOps extension');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure Azure DevOps organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure Azure DevOps project');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle OIDC token retrieval for Azure DevOps authentication', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsOidcTokenRetrieval.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('az login --service-principal'), 'Should use federated token for login');
            assert(tr.stdout.includes('--federated-token'), 'Should include federated token parameter');
            assert(tr.stdout.includes('--allow-no-subscriptions'), 'Should allow login without subscriptions');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should fail when OIDC token retrieval fails', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsOidcTokenFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.indexOf('Failed to setup Azure DevOps CLI') >= 0, 'Should fail with OIDC token error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle Azure DevOps extension installation failure gracefully', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsExtensionInstallFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.includes('Azure DevOps extension not found in working environment'), 'Should check if extension is installed');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should attempt to install Azure DevOps extension');
            assert(tr.stdout.indexOf('loc_mock_FailedToInstallAzureDevOpsCLI') >= 0, 'Should fail with extension installation error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should validate environment variables are set for Azure DevOps authentication', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsEnvironmentVariables.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should properly cleanup Azure DevOps configuration on task completion', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsCleanup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('az devops configure --defaults project=\'\' organization='), 'Should clear Azure DevOps configuration');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle authentication with visible Azure login enabled', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsVisibleLogin.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(!tr.stdout.includes('--output none'), 'Should not suppress login output when visible login is enabled');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle authentication with organization URL containing special characters', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsSpecialCharacters.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure project');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should fail with invalid connectionType input', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0ConnectionTypeValidation.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed with invalid connectionType');
            assert(tr.stderr.includes('Unsupported connection type: invalidConnectionType') || tr.errorIssues.some(issue => issue.includes('Unsupported connection type: invalidConnectionType')), 'Should fail with unsupported connection type error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle Azure DevOps organization configuration error gracefully', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsOrganizationConfigError.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.indexOf('loc_mock_FailedToSetAzureDevOpsOrganization') >= 0, 'Should fail with organization configuration error message');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should handle Azure DevOps project configuration error gracefully', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsProjectConfigError.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.indexOf('loc_mock_FailedToSetAzureDevOpsProject') >= 0, 'Should fail with project configuration error message');
            done();
        }).catch((err) => {
            done(err);
        });
    });
});
 