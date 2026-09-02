import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { runValidateScriptArgsTests } from './L0ValidateScriptArgs';
import { runTryValidateScriptArgsTests } from './L0TryValidateScriptArgs';
import { runConfigDirIsolationTests } from './L0ConfigDirIsolation';

describe('AzureCLIV3 Suite', function () {
    const timeout = 30000;
    this.timeout(timeout);

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

    it('Windows PS/PSCore: File invocation with caret in password (AzureCliUseFileInvocation flag)', async function() {
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

    it('File invocation: Task succeeds with % and ^ in password (pscore, FF on)', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0FileInvocationPercentPassword.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with % and ^ in password');
        assert(tr.stdout.indexOf('Using -File invocation for PowerShell Core to avoid CMD metacharacter issues') >= 0, 'should log -File invocation usage');
        assert(tr.stdout.indexOf('Using direct python.exe invocation for az login to bypass az.cmd') >= 0, 'should use direct python.exe login for % password');
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV3/DirectPythonLogin') >= 0, 'should emit DirectPythonLogin telemetry');
    });

    it('Direct python login: python.exe path used when FF on and python.exe exists', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0DirectPythonLogin.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with direct python login');
        assert(tr.stdout.indexOf('Using direct python.exe invocation for az login to bypass az.cmd') >= 0, 'should log direct python login usage');
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV3/DirectPythonLogin') >= 0, 'should emit DirectPythonLogin telemetry');
    });

    it('Az module injection: injects dynamic module when FF on + az found + python.exe exists', async () => {
        let tp = path.join(__dirname, 'L0AzModuleInjection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MKDTEMP_CALLED:') >= 0, 'should create a temp directory via mkdtempSync');
        assert(tr.stdout.indexOf('New-Module') >= 0, 'wrapper should contain New-Module');
        assert(tr.stdout.indexOf('Import-Module -ModuleInfo') >= 0, 'wrapper should contain Import-Module -ModuleInfo');
        assert(tr.stdout.indexOf('-Global -Force') >= 0, 'wrapper should contain -Global -Force');
        assert(tr.stdout.indexOf('Add-Member -NotePropertyName Path') >= 0, 'wrapper should contain Add-Member -NotePropertyName Path');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzModuleInjection, {"status":"prepared"}') >= 0, 'should emit AzModuleInjection telemetry with status=prepared');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzShimCreated, {"status":"created"}') >= 0, 'should emit AzShimCreated telemetry');
        assert(tr.stdout.indexOf('Az module preamble failed') >= 0 || tr.stdout.indexOf('Az CLI module injected successfully') >= 0, 'wrapper should contain preamble try/catch with success or failure marker');
        assert(tr.stdout.indexOf('} catch {') >= 0, 'wrapper should have catch block for preamble failure');
        assert(tr.stdout.indexOf("AZ_INSTALLER = 'MSI'") >= 0, 'shim should set AZ_INSTALLER');
        assert(tr.stdout.indexOf('-IBm azure.cli') >= 0, 'shim should invoke azure.cli module');
        assert(tr.stdout.indexOf('exit $azExitCode') >= 0, 'shim should propagate exit code');
    });

    it('Az module injection: FF off uses legacy getPowerShellScriptPath without module', async () => {
        let tp = path.join(__dirname, 'L0AzModuleFlagOff.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('New-Module') === -1, 'generated script should NOT contain New-Module when FF is off');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzModuleInjection') === -1, 'should NOT emit AzModuleInjection telemetry');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzShimCreated') === -1, 'should NOT emit AzShimCreated telemetry');
    });

    it('Az module injection: skipped when az not found on PATH', async () => {
        let tp = path.join(__dirname, 'L0AzModuleSkippedNoAz.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzModuleInjection, {"status":"skipped","reason":"az not found on PATH"}') >= 0, 'should emit skipped telemetry with reason');
    });

    it('Az module injection: skipped when python.exe not found', async () => {
        let tp = path.join(__dirname, 'L0AzModuleSkippedNoPython.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzModuleInjection, {"status":"skipped","reason":"python.exe not found"}') >= 0, 'should emit skipped telemetry with reason');
    });

    it('Az module fallback: falls back to -Command when file invocation setup fails', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0AzModuleFallbackToCommand.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded via -Command fallback');
        assert(tr.stdout.indexOf('FALLBACK_TO_LEGACY_PATH') >= 0, 'should fall back to legacy getPowerShellScriptPath');
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV3/FileInvocationFallback') >= 0, 'should emit FileInvocationFallback telemetry');
        assert(tr.stdout.indexOf('"scriptType":"pscore"') >= 0, 'telemetry should include scriptType');
        assert(tr.stdout.indexOf('mkdtempSync failed') >= 0, 'telemetry should include error message');
    });

    it('Az module failure: shim write error propagates and triggers cleanup', async () => {
        let tp = path.join(__dirname, 'L0AzModuleShimWriteFailure.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task helper should have succeeded');
        assert(tr.stdout.indexOf('MKDTEMP_CREATED:') >= 0, 'shim directory should have been created before write failure');
        assert(tr.stdout.indexOf('EXPECTED_ERROR:') >= 0, 'should throw an error');
        assert(tr.stdout.indexOf('EACCES') >= 0, 'error should contain the permission error from az.ps1 write');
        assert(tr.stdout.indexOf('RMRF_MATCHES_CREATED_DIR:true') >= 0, 'rmRF should receive the exact shim directory');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV3, AzShimCleanup') >= 0, 'should attempt shim directory cleanup');
        assert(tr.stdout.indexOf('SHIM_DIR_EXISTS_AFTER_CLEANUP:false') >= 0, 'shim directory should be removed after write failure');
    });

    it('Az module: generated wrapper preserves the PowerShell runtime contract', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0AzModuleCallerPrefs.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'generated wrapper process test should have succeeded');
        assert(tr.stdout.indexOf('GENERATED_WRAPPER:') >= 0, 'test should execute a wrapper generated by Utility');
        assert(tr.stdout.indexOf('PWSH_OUTPUT_START') >= 0, 'generated wrapper should run under pwsh');
        assert(tr.stdout.indexOf('WINDOWS_POWERSHELL_OUTPUT_START') >= 0, 'generated wrapper should run under Windows PowerShell');
        assert((tr.stdout.match(/COMMAND_METADATA_VALID:True/g) || []).length === 2, 'az Source and Path should identify the shim in both hosts');
        assert((tr.stdout.match(/FAKE_AZ_INSTALLER:MSI/g) || []).length >= 3, 'generated function should set AZ_INSTALLER for each native invocation');
        assert((tr.stdout.match(/FAKE_ARG_2:c3BhY2UgdmFsdWU=/g) || []).length === 2, 'space-containing argument should be forwarded in both hosts');
        assert((tr.stdout.match(/FAKE_ARG_3:c3BlY2lhbCVeJg==/g) || []).length === 2, 'special-character argument should be forwarded in both hosts');
        assert((tr.stdout.match(/ENV_RESTORED_AFTER_SUCCESS:True/g) || []).length === 2, 'AZ_INSTALLER should be restored after successful calls');
        assert(tr.stdout.indexOf('CALLER_FUNCTION_ENTERED:true') >= 0, 'pwsh should invoke az from a caller function');
        assert((tr.stdout.match(/FAKE_ARG_2:\r?$/gm) || []).length === 1, 'caller argument-passing preference should preserve an empty argument');
        assert(tr.stdout.indexOf('FAKE_ARG_3:cXVvdGUidmFsdWU=') >= 0, 'caller argument-passing preference should preserve an embedded quote');
        assert(tr.stdout.indexOf('NATIVE_EXCEPTION_TYPE:NativeCommandExitException') >= 0, 'pwsh should honor the caller native error preference');
        assert(tr.stdout.indexOf('FAKE_ARG_2:YWZ0ZXItZmFpbHVyZQ==') < 0, 'successful az following the failure should not execute');
        assert(tr.stdout.indexOf('FOLLOWING_NATIVE_COMMAND_RAN:false') >= 0, 'pwsh should stop before the following native command');
        assert(tr.stdout.indexOf('WINDOWS_POWERSHELL_EXIT_CODE:0') >= 0, 'Windows PowerShell invocation should forward arguments and succeed');
        assert((tr.stdout.match(/ENV_RESTORED_AFTER_FAILURE:True/g) || []).length === 2, 'AZ_INSTALLER should be restored after all calls');
    });

    it('Direct python login fallback: falls back to az.cmd when python.exe not found', async function() {
        if (process.platform !== 'win32') {
            this.skip();
            return;
        }
        let tp = path.join(__dirname, 'L0DirectPythonLoginFallback.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        if (!tr.succeeded) {
            console.log('STDOUT:', tr.stdout);
            console.log('STDERR:', tr.stderr);
        }

        assert(tr.succeeded, 'task should have succeeded with az.cmd fallback');
        assert(tr.stdout.indexOf('python.exe not found; falling back to az.cmd for login.') >= 0, 'should log fallback reason');
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV3/DirectPythonLogin') >= 0, 'should emit fallback telemetry');
        assert(tr.stdout.indexOf('"status":"fallback"') >= 0, 'telemetry should indicate fallback status');
    });
});