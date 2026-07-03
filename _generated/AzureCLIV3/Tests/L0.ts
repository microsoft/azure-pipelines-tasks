import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { runValidateScriptArgsTests } from './L0ValidateScriptArgs';
import { runTryValidateScriptArgsTests } from './L0TryValidateScriptArgs';
import { runConfigDirIsolationTests } from './L0ConfigDirIsolation';

describe('AzureCLIV3 Suite', function () {
    const timeout = 30000;

    before(() => {
    });

    after(() => {
    });

    describe('Script args sanitizer (AZP_75787_*)', () => {
        runValidateScriptArgsTests();
    });

    describe('Args validation feature flag (EnableAzureCliArgsValidation)', () => {
        runTryValidateScriptArgsTests();
    });

    describe('AZURE_CONFIG_DIR isolation', () => {
        runConfigDirIsolationTests();
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
            assert(tr.stdout.indexOf('loc_mock_AzureDevOpsExtensionInstalled') >= 0, 'should install Azure DevOps extension');
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
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionAlreadyInstalled'), 'Should check if extension is installed and skip installation');
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
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionNotFound'), 'Should check if extension is installed');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should attempt to install Azure DevOps extension');
            assert(tr.warningIssues.some(w => w.includes('Error Code: [1]')), 'Should warn with the standard install exit code');
            assert(tr.warningIssues.some(w => w.includes('loc_mock_FailedToInstallAzureDevOpsCLI')), 'Should warn that the standard install failed');
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionStandardInstallFailed'), 'Should log standard installation failure');
            assert(tr.stdout.indexOf('loc_mock_FailedToInstallAzureDevOpsCLI') >= 0, 'Should fail with extension installation error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should not attempt no-deps fallback when feature flag is off', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsExtensionInstallFailureNoFF.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionNotFound'), 'Should check if extension is installed');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should attempt to install Azure DevOps extension');
            assert(!tr.stdout.includes('loc_mock_AzureDevOpsExtensionStandardInstallFailed'), 'Should not log standard installation failure message');
            assert(!tr.stdout.includes('az extension add --name azure-devops'), 'Should not attempt no-deps install');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should fall back to no-deps installation when standard extension install fails', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsExtensionWheelFallback.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'should have succeeded');
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionNotFound'), 'Should check if extension is installed');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should attempt standard installation first');
            assert(tr.warningIssues.some(w => w.includes('Error Code: [1]')), 'Should warn with the standard install exit code');
            assert(tr.warningIssues.some(w => w.includes('loc_mock_FailedToInstallAzureDevOpsCLI')), 'Should warn that the standard install failed before falling back');
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionStandardInstallFailed'), 'Should log standard installation failure');
            assert(tr.stdout.includes('az extension add --name azure-devops'), 'Should attempt no-deps installation as fallback');
            assert(tr.stdout.includes('loc_mock_AzureDevOpsExtensionInstalledNoDeps'), 'Should install with no-deps successfully');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure project');
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

    it('Az Version Parsing: Handles JSON format output (UseAzVersion enabled)', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_JsonFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with JSON format az version output');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Az Version Parsing: Handles table format output (UseAzVersion enabled)', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_TableFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with table format az version output');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Az Version Parsing: Handles text format output (UseAzVersion enabled)', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_TextFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with text format az version output');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Az Version Parsing: Older version (< 2.66.0) is correctly parsed and compared', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_OlderVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with older az version');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.50.0') >= 0, 'should correctly extract version 2.50.0');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Az Version Parsing: Handles TSV format output (UseAzVersion enabled)', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_TsvFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with TSV format az version output');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Az Version Parsing: Handles YAML format output (UseAzVersion enabled)', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'AzVersionParse_YamlFormat.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded with YAML format az version output');
            assert(tr.stdout.indexOf("Can't parse az version") === -1, 'should not emit version parse error');
            assert(tr.stdout.indexOf('Current Azure CLI version: 2.85.0') >= 0, 'should correctly extract version 2.85.0');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('LateBoundIdToken: Feature Flag ON, Token Present -> Uses Token, Emits Telemetry', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOn_TokenPresent.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, LateBoundIdToken, {"connectedService":"AzureRM","idTokenPresent":"true"}') >= 0, 'should emit telemetry with idTokenPresent=true');
            assert(tr.stdout.indexOf('Using bound idToken from service endpoint.') >= 0, 'should log that it is using bound idToken');
            assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') === -1, 'should NOT call createOidcToken');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('LateBoundIdToken: Feature Flag ON, Token Missing -> Calls API, Emits Telemetry', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOn_TokenMissing.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, LateBoundIdToken, {"connectedService":"AzureRM","idTokenPresent":"false"}') >= 0, 'should emit telemetry with idTokenPresent=false');
            assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') >= 0, 'should call createOidcToken');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('LateBoundIdToken: Feature Flag OFF -> Calls API, No Telemetry', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'LateBoundIdToken_FeatureFlagOff.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, LateBoundIdToken') === -1, 'should NOT emit LateBoundIdToken telemetry');
            assert(tr.stdout.indexOf('MOCK_CREATE_OIDC_TOKEN_CALLED') >= 0, 'should call createOidcToken');
            done();
        }).catch((err) => {
            done(err);
        });
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
});