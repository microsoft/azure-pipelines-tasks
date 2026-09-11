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
        assert(tr.stdout.indexOf('Set-Alias -Name az') >= 0, 'wrapper should create an az alias targeting the shim');
        assert(tr.stdout.indexOf('Export-ModuleMember -Alias az') >= 0, 'wrapper should export the az alias');
        assert(tr.stdout.indexOf('Import-Module -ModuleInfo') >= 0, 'wrapper should contain Import-Module -ModuleInfo');
        assert(tr.stdout.indexOf('-Global -Force') >= 0, 'wrapper should contain -Global -Force');
        assert(tr.stdout.indexOf('Add-Member -NotePropertyName Path') >= 0, 'wrapper should contain Add-Member -NotePropertyName Path');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzModuleInjection, {"status":"prepared"}') >= 0, 'should emit AzModuleInjection telemetry with status=prepared');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzShimCreated, {"status":"created"}') >= 0, 'should emit AzShimCreated telemetry');
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
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzModuleInjection') === -1, 'should NOT emit AzModuleInjection telemetry');
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzShimCreated') === -1, 'should NOT emit AzShimCreated telemetry');
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
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzModuleInjection, {"status":"skipped","reason":"az not found on PATH"}') >= 0, 'should emit skipped telemetry with reason');
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
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzModuleInjection, {"status":"skipped","reason":"python.exe not found"}') >= 0, 'should emit skipped telemetry with reason');
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
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV2/FileInvocationFallback') >= 0, 'should emit FileInvocationFallback telemetry');
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
        assert(tr.stdout.indexOf('MOCK_TELEMETRY: AzureCLIV2, AzShimCleanup') >= 0, 'should attempt shim directory cleanup');
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
        assert((tr.stdout.match(/COMMAND_METADATA_VALID:True/g) || []).length === 2, 'az Source, Path, and Definition should identify the shim in both hosts');
        assert((tr.stdout.match(/CAPTURED_SOURCE_EXECUTED:True/g) || []).length === 2, 'the captured az Source should execute successfully in both hosts');
        assert((tr.stdout.match(/FAKE_AZ_INSTALLER:MSI/g) || []).length >= 10, 'generated alias should set AZ_INSTALLER for each native invocation');
        assert((tr.stdout.match(/FAKE_ARG_2:c3BhY2UgdmFsdWU=/g) || []).length === 2, 'space-containing argument should be forwarded in both hosts');
        assert((tr.stdout.match(/FAKE_ARG_3:c3BlY2lhbCVeJg==/g) || []).length === 2, 'special-character argument should be forwarded in both hosts');
        assert((tr.stdout.match(/ENV_RESTORED_AFTER_SUCCESS:True/g) || []).length === 2, 'AZ_INSTALLER should be restored after successful calls');
        assert(tr.stdout.indexOf('OUTER_CALLER_ENTERED:true') >= 0, 'pwsh should set preferences in an outer caller function');
        assert(tr.stdout.indexOf('INNER_CALLER_ENTERED:true') >= 0, 'pwsh should invoke az from a nested inner caller function');
        assert((tr.stdout.match(/FAKE_ARG_2:\r?$/gm) || []).length === 1, 'caller argument-passing preference should preserve an empty argument');
        assert(tr.stdout.indexOf('FAKE_ARG_3:cXVvdGUidmFsdWU=') >= 0, 'caller argument-passing preference should preserve an embedded quote');
        assert(tr.stdout.indexOf('NATIVE_EXCEPTION_TYPE:NativeCommandExitException') >= 0, 'pwsh should honor the caller native error preference');
        assert(tr.stdout.indexOf('FAKE_ARG_2:YWZ0ZXItZmFpbHVyZQ==') < 0, 'successful az following the failure should not execute');
        assert(tr.stdout.indexOf('FOLLOWING_NATIVE_COMMAND_RAN:false') >= 0, 'pwsh should stop before the following native command');
        assert(tr.stdout.indexOf('ENV_RESTORED_AFTER_NATIVE_EXCEPTION:True') >= 0, 'AZ_INSTALLER should be restored after a native exception');
        assert((tr.stdout.match(/NONZERO_SUCCESS:False/g) || []).length === 2, 'both hosts should preserve native command failure status');
        assert((tr.stdout.match(/NONZERO_EXIT_CODE:7/g) || []).length === 2, 'both hosts should preserve LASTEXITCODE after a nonzero az exit');
        assert((tr.stdout.match(/ENV_RESTORED_AFTER_NONZERO:True/g) || []).length === 2, 'AZ_INSTALLER should be restored after nonzero exits');
        assert((tr.stdout.match(/ENV_EMPTY_STATE_RESTORED:True/g) || []).length === 2, 'both hosts should restore their native representation of an empty AZ_INSTALLER value');
        assert((tr.stdout.match(/SHADOWED_BUILTINS_SUCCESS:True/g) || []).length === 2, 'customer functions must not shadow required built-in commands');
        assert((tr.stdout.match(/ENV_ABSENT_AFTER_SHADOWED_SUCCESS:True/g) || []).length === 2, 'AZ_INSTALLER should return to its absent state after success');
        assert(tr.stdout.indexOf('GENERATED_CONSTRAINED_WRAPPER:') >= 0, 'test should execute a separately generated constrained-language wrapper');
        assert((tr.stdout.match(/FAKE_ARG_2:Y29uc3RyYWluZWQtbGFuZ3VhZ2U=/g) || []).length === 2, 'the fake Azure CLI should execute in ConstrainedLanguage mode under both hosts');
        assert((tr.stdout.match(/CONSTRAINED_MODE:ConstrainedLanguage/g) || []).length === 2, 'both hosts should enter ConstrainedLanguage mode');
        assert((tr.stdout.match(/CONSTRAINED_EXIT_CODE:0/g) || []).length === 2, 'constrained-language az calls should propagate their exit code');
        assert((tr.stdout.match(/CONSTRAINED_ENV_RESTORED:True/g) || []).length === 2, 'AZ_INSTALLER should be restored in ConstrainedLanguage mode');
        assert((tr.stdout.match(/TASK_ALIAS_ACTIVE:True/g) || []).length === 6, 'the task alias should override each pre-existing command in both hosts');
        assert((tr.stdout.match(/TASK_ALIAS_REMOVED:True/g) || []).length === 6, 'module removal should remove only the task-owned alias in both hosts');
        assert((tr.stdout.match(/PREVIOUS_COMMAND_RESTORED:True/g) || []).length === 6, 'module removal should reveal the previous application, function, or alias');
        assert((tr.stdout.match(/PARTIAL_IMPORT_ALIAS_REMOVED:True/g) || []).length === 2, 'post-import failure should remove the task alias in both hosts');
        assert((tr.stdout.match(/PARTIAL_IMPORT_FALLBACK_APPLICATION:True/g) || []).length === 2, 'post-import failure should fall back to az.cmd in both hosts');
        assert((tr.stdout.match(/Az module preamble failed: injected post-import failure/g) || []).length === 2, 'post-import failure should emit a warning in both hosts');
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
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV2/DirectPythonLogin') >= 0, 'should emit DirectPythonLogin telemetry');
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
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV2/DirectPythonLogin') >= 0, 'should emit DirectPythonLogin telemetry');
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
        assert(tr.stdout.indexOf('TELEMETRY: AzureCLIV2/DirectPythonLogin') >= 0, 'should emit fallback telemetry');
        assert(tr.stdout.indexOf('"status":"fallback"') >= 0, 'telemetry should indicate fallback status');
    });
});
