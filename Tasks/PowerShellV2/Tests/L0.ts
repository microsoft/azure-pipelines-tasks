import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { testEnvExpansion } from './L0EnvExpansion';
import { runValidateFileArgsTests } from './L0ValidateFileArgs';

describe('PowerShell Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    }

    it('Runs an inline script correctly', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0Inline.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$ErrorActionPreference = 'Stop'${os.EOL}$ProgressPreference = 'SilentlyContinue'${os.EOL}Write-Host "my script output" to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0, 'PowerShell should have correctly run the script');
        }, tr);
    });

    it('Runs a checked in script correctly', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$ErrorActionPreference = 'Stop'${os.EOL}$ProgressPreference = 'SilentlyContinue'${os.EOL}. 'path/to/script.ps1' to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0, 'PowerShell should have correctly run the script');
        }, tr);
    });

    it('Adds arguments to the script', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0Args.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$ErrorActionPreference = 'Stop'${os.EOL}$ProgressPreference = 'SilentlyContinue'${os.EOL}. 'path/to/script.ps1' myCustomArg to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0, 'PowerShell should have correctly run the script');
        }, tr);
    });

    it('Reports stderr correctly', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0StdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.failed, 'Powershell should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;source=CustomerScript;]myErrorTest') > 0, 'Powershell should have correctly written myErrorTest');
            assert(tr.stdout.length > 1000, 'Powershell stderr output is not truncated');
        }, tr);
    });

    it('Runs scripts with & operator', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0RunScriptInSeparateScope.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$ErrorActionPreference = 'Stop'${os.EOL}$ProgressPreference = 'SilentlyContinue'${os.EOL}. 'path/to/script.ps1' to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0, 'PowerShell should have correctly run the script');
        }, tr);
    });

    it('Respects WarningAction when showWarnings is enabled', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ShowWarnings.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            
            // Should only show one Azure DevOps warning (the first one without WarningAction)
            const azureWarnings = tr.stdout.match(/##vso\[task\.logissue type=warning;\]/g);
            assert(azureWarnings && azureWarnings.length === 1, 'Should only show one Azure DevOps warning for the default warning');
            
            // Should show the default warning as Azure DevOps warning
            assert(tr.stdout.indexOf('##vso[task.logissue type=warning;]a) Default: Shows = true & Expected = true') > 0, 
                'Should show the default warning as Azure DevOps warning');
            
            // Should NOT show suppressed warnings as Azure DevOps warnings
            assert(tr.stdout.indexOf('##vso[task.logissue type=warning;]b) SilentlyContinue') === -1,
                'Should not show SilentlyContinue warning as Azure DevOps warning');
            assert(tr.stdout.indexOf('##vso[task.logissue type=warning;]c) Ignore') === -1,
                'Should not show Ignore warning as Azure DevOps warning');
            assert(tr.stdout.indexOf('##vso[task.logissue type=warning;]d) Redirect') === -1,
                'Should not show redirected warning as Azure DevOps warning');
        }, tr);
    });

    describe('Environment variable expansion', testEnvExpansion);
    describe('Validate file arguments', runValidateFileArgsTests)
});
