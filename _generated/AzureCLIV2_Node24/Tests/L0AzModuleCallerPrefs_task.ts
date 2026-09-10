import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Utility } from '../src/Utility';

const mockTask = require('azure-pipelines-task-lib/mock-task');

const testRoot = process.env['TEST_AZ_PROCESS_ROOT'];
const sourcePath = path.join(testRoot, 'fake-python.cs');
const pythonPath = path.join(testRoot, 'python.exe');
const cscPath = path.join(process.env['WINDIR'], 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const childEnvironment = {
    ...process.env,
    PATH: path.join(testRoot, 'wbin') + path.delimiter + process.env['PATH']
};

const launcherSource = `
using System;
using System.Text;

public class Program
{
    public static int Main(string[] args)
    {
        Console.WriteLine("FAKE_AZ_INSTALLER:" + Environment.GetEnvironmentVariable("AZ_INSTALLER"));
        for (int index = 0; index < args.Length; index++)
        {
            Console.WriteLine("FAKE_ARG_" + index + ":" + Convert.ToBase64String(Encoding.UTF8.GetBytes(args[index])));
        }
        return Array.IndexOf(args, "fail") >= 0 ? 7 : 0;
    }
}
`;

function runPowerShell(executable: string, wrapperPath: string, marker: string): void {
    const output = child_process.execFileSync(
        executable,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath],
        { encoding: 'utf8', timeout: 15000, env: childEnvironment }
    );
    console.log(`${marker}_OUTPUT_START`);
    console.log(output);
    console.log(`${marker}_OUTPUT_END`);
}

function runConstrainedPowerShell(executable: string, wrapperPath: string, marker: string): void {
    const escapedWrapperPath = wrapperPath.replace(/'/g, "''");
    const output = child_process.execFileSync(
        executable,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `$ExecutionContext.SessionState.LanguageMode = 'ConstrainedLanguage'; & '${escapedWrapperPath}'`],
        { encoding: 'utf8', timeout: 15000, env: childEnvironment }
    );
    console.log(`${marker}_OUTPUT_START`);
    console.log(output);
    console.log(`${marker}_OUTPUT_END`);
}

function runPowerShellWithSetup(executable: string, wrapperPath: string, setup: string, marker: string): void {
    const escapedWrapperPath = wrapperPath.replace(/'/g, "''");
    const output = child_process.execFileSync(
        executable,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `${setup}; & '${escapedWrapperPath}'`],
        { encoding: 'utf8', timeout: 15000, env: childEnvironment }
    );
    console.log(`${marker}_OUTPUT_START`);
    console.log(output);
    console.log(`${marker}_OUTPUT_END`);
}

async function generateWrapper(inlineScript: string): Promise<{ scriptPath: string; azShimDirectory?: string }> {
    const originalGetInput = mockTask.getInput;
    mockTask.getInput = (name: string, required?: boolean) => name === 'inlineScript' ? inlineScript : originalGetInput(name, required);
    try {
        return await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
    } finally {
        mockTask.getInput = originalGetInput;
    }
}

async function main(): Promise<void> {
    fs.writeFileSync(sourcePath, launcherSource, { encoding: 'utf8' });
    child_process.execFileSync(
        cscPath,
        ['/nologo', '/target:exe', `/out:${pythonPath}`, sourcePath],
        { encoding: 'utf8', timeout: 15000 }
    );

    const result = await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
    console.log('GENERATED_WRAPPER:' + result.scriptPath);
    try {
        runPowerShell('pwsh.exe', result.scriptPath, 'PWSH');
        runPowerShell('powershell.exe', result.scriptPath, 'WINDOWS_POWERSHELL');

        const constrainedResult = await generateWrapper(`
$env:AZ_INSTALLER = 'ConstrainedOriginal'
az constrained-language
Write-Host "CONSTRAINED_MODE:$($ExecutionContext.SessionState.LanguageMode)"
Write-Host "CONSTRAINED_EXIT_CODE:$LASTEXITCODE"
Write-Host "CONSTRAINED_ENV_RESTORED:$($env:AZ_INSTALLER -eq 'ConstrainedOriginal')"
$global:LASTEXITCODE = 0
`);
        console.log('GENERATED_CONSTRAINED_WRAPPER:' + constrainedResult.scriptPath);
        runConstrainedPowerShell('pwsh.exe', constrainedResult.scriptPath, 'PWSH_CONSTRAINED');
        runConstrainedPowerShell('powershell.exe', constrainedResult.scriptPath, 'WINDOWS_POWERSHELL_CONSTRAINED');

        const lifecycleResult = await generateWrapper(`
$taskAlias = Get-Command az -CommandType Alias -ErrorAction Stop
Write-Host "TASK_ALIAS_ACTIVE:$($taskAlias.Definition -eq $azureCliTaskShimPath)"
az lifecycle-collision
Remove-Module -ModuleInfo $azureCliTaskModule -Force
$aliasAfterRemoval = Get-Command az -CommandType Alias -ErrorAction SilentlyContinue
Write-Host "TASK_ALIAS_REMOVED:$(-not $aliasAfterRemoval -or $aliasAfterRemoval.Definition -ne $azureCliTaskShimPath)"
$restoredCommand = Get-Command az -ErrorAction Stop
Write-Host "PREVIOUS_COMMAND_RESTORED:$($restoredCommand.CommandType -eq $env:EXPECTED_AZ_COMMAND_TYPE)"
az after-module-removal
$global:LASTEXITCODE = 0
`);
        const lifecycleSetups = [
            { name: 'APPLICATION', command: `$env:EXPECTED_AZ_COMMAND_TYPE = 'Application'` },
            { name: 'FUNCTION', command: `function global:az { Write-Host 'CUSTOMER_FUNCTION_EXECUTED' }; $env:EXPECTED_AZ_COMMAND_TYPE = 'Function'` },
            { name: 'ALIAS', command: `function global:CustomerAzAliasTarget { Write-Host 'CUSTOMER_ALIAS_EXECUTED' }; Set-Alias -Name az -Value CustomerAzAliasTarget -Scope Global; $env:EXPECTED_AZ_COMMAND_TYPE = 'Alias'` }
        ];
        for (const setup of lifecycleSetups) {
            runPowerShellWithSetup('pwsh.exe', lifecycleResult.scriptPath, setup.command, `PWSH_LIFECYCLE_${setup.name}`);
            runPowerShellWithSetup('powershell.exe', lifecycleResult.scriptPath, setup.command, `WINDOWS_POWERSHELL_LIFECYCLE_${setup.name}`);
        }

        const partialFailureResult = await generateWrapper(`
$remainingAlias = Get-Command az -CommandType Alias -ErrorAction SilentlyContinue
Write-Host "PARTIAL_IMPORT_ALIAS_REMOVED:$(-not $remainingAlias -or $remainingAlias.Definition -ne $azureCliTaskShimPath)"
$fallbackCommand = Get-Command az -CommandType Application -ErrorAction Stop | Select-Object -First 1
Write-Host "PARTIAL_IMPORT_FALLBACK_APPLICATION:$($fallbackCommand.CommandType -eq 'Application')"
az partial-import-fallback
$global:LASTEXITCODE = 0
`);
        const partialFailureContents = fs.readFileSync(partialFailureResult.scriptPath, 'utf8').replace(
            `    $azureCliTaskAzCommand | Add-Member -NotePropertyName Path -NotePropertyValue $azureCliTaskShimPath -Force`,
            `    throw 'injected post-import failure'`
        );
        fs.writeFileSync(partialFailureResult.scriptPath, partialFailureContents, 'utf8');
        runPowerShell('pwsh.exe', partialFailureResult.scriptPath, 'PWSH_PARTIAL_IMPORT_FAILURE');
        runPowerShell('powershell.exe', partialFailureResult.scriptPath, 'WINDOWS_POWERSHELL_PARTIAL_IMPORT_FAILURE');
    } finally {
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
