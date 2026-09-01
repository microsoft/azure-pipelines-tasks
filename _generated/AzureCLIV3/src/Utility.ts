import tl = require("azure-pipelines-task-lib/task");
import os = require("os");
import path = require("path");
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import fs = require("fs");
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

export interface PowerShellScriptResult {
    scriptPath: string;
    azShimDirectory?: string;
}

interface AzModulePreamble {
    azShimDirectory: string;
    lines: string[];
}

export class Utility {

    public static async getScriptPath(scriptLocation: string, fileExtensions: string[]): Promise<string> {
        if (scriptLocation.toLowerCase() === "scriptpath") {
            let filePath: string = tl.getPathInput("scriptPath", true, false);
            if (Utility.checkIfFileExists(filePath, fileExtensions)) {
                return filePath;
            }
            throw new Error(tl.loc('JS_InvalidFilePath', filePath));
        }
        let tempDirectory = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
        let inlineScript: string = tl.getInput("inlineScript", true);
        let scriptPath: string = path.join(tempDirectory, `azureclitaskscript${new Date().getTime()}.${fileExtensions[0]}`);
        await Utility.createFile(scriptPath, inlineScript);
        return scriptPath;
    }

    public static async getPowerShellScriptPath(scriptLocation: string, fileExtensions: string[], scriptArguments: string): Promise<string> {
        let powerShellErrorActionPreference: string = tl.getInput('powerShellErrorActionPreference', false) || 'Stop';
        switch (powerShellErrorActionPreference.toUpperCase()) {
            case 'STOP':
            case 'CONTINUE':
            case 'SILENTLYCONTINUE':
                break;
            default:
                throw new Error(tl.loc('JS_InvalidErrorActionPreference', powerShellErrorActionPreference));
        }

        // Write the script to disk.
        tl.assertAgent('2.115.0');
        let tempDirectory = tl.getVariable('Agent.TempDirectory') || os.tmpdir();

        let contents: string[] = [];
        contents.push(`$ErrorActionPreference = '${powerShellErrorActionPreference}'`);
        contents.push(`$ErrorView = 'NormalView'`);

        let filePath: string = tl.getPathInput("scriptPath", false, false);
        if (scriptLocation.toLowerCase() === 'inlinescript') {
            let inlineScript: string = tl.getInput("inlineScript", true);
            filePath = path.join(tempDirectory, `azureclitaskscript${new Date().getTime()}_inlinescript.${fileExtensions[0]}`);
            await Utility.createFile(filePath, inlineScript);
        }
        else{
            if (!Utility.checkIfFileExists(filePath, fileExtensions)) {
                throw new Error(tl.loc('JS_InvalidFilePath', filePath));
            }
        }

        let content: string = `. '${filePath.replace(/'/g, "''")}' `;
        if (scriptArguments) {
            content += scriptArguments;
        }
        contents.push(content.trim());

        let powerShellIgnoreLASTEXITCODE: boolean = tl.getBoolInput('powerShellIgnoreLASTEXITCODE', false);
        if (!powerShellIgnoreLASTEXITCODE) {
            contents.push(`if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {`);
            contents.push(`    Write-Host '##vso[task.debug]$LASTEXITCODE is not set.'`);
            contents.push(`} else {`);
            contents.push(`    Write-Host ('##vso[task.debug]$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
            contents.push(`    exit $LASTEXITCODE`);
            contents.push(`}`);
        }

        let scriptPath: string = path.join(tempDirectory, `azureclitaskscript${new Date().getTime()}.${fileExtensions[0]}`);
        await Utility.createFile(scriptPath, '\ufeff' + contents.join(os.EOL), { encoding: 'utf8' });
        return scriptPath;
    }

    public static checkIfAzurePythonSdkIsInstalled() {
        return !!tl.which("az", false);
    }

    public static throwIfError(resultOfToolExecution: IExecSyncResult, errormsg?: string): void {
        if (resultOfToolExecution.code != 0) {
            tl.error("Error Code: [" + resultOfToolExecution.code + "]");
            if (errormsg) {
                tl.error("Error: " + errormsg);
            }
            throw resultOfToolExecution;
        }
    }

    public static async createFile(filePath: string, data: string, options?: any): Promise<void> {
        try {
            fs.writeFileSync(filePath, data, options);
        }
        catch (err) {
            Utility.deleteFile(filePath);
            throw err;
        }
    }

    public static checkIfFileExists(filePath: string, fileExtensions: string[]): boolean {
        let matchingFiles: string[] = fileExtensions.filter((fileExtension: string) => {
            if (tl.stats(filePath).isFile() && filePath.toUpperCase().match(new RegExp(`\.${fileExtension.toUpperCase()}$`))) {
                return true;
            }
        });
        if (matchingFiles.length > 0) {
            return true;
        }
        return false;
    }

    public static async deleteFile(filePath: string): Promise<void> {
        if (fs.existsSync(filePath)) {
            try {
                //delete the publishsetting file created earlier
                fs.unlinkSync(filePath);
            }
            catch (err) {
                //error while deleting should not result in task failure
                console.error(err.toString());
            }
        }
    }

    public static async getPowerShellScriptPathWithAzModule(
        scriptLocation: string,
        fileExtensions: string[],
        scriptArguments: string
    ): Promise<PowerShellScriptResult> {
        let powerShellErrorActionPreference: string = tl.getInput('powerShellErrorActionPreference', false) || 'Stop';
        switch (powerShellErrorActionPreference.toUpperCase()) {
            case 'STOP':
            case 'CONTINUE':
            case 'SILENTLYCONTINUE':
                break;
            default:
                throw new Error(tl.loc('JS_InvalidErrorActionPreference', powerShellErrorActionPreference));
        }

        tl.assertAgent('2.115.0');

        const tempDirectory = tl.getVariable('Agent.TempDirectory') || os.tmpdir();

        let azShimDirectory: string | undefined;
        let wrapperScriptPath: string | undefined;

        try {
            const contents: string[] = [];
            contents.push(`$ErrorActionPreference = '${powerShellErrorActionPreference}'`);
            contents.push(`$ErrorView = 'NormalView'`);

            const modulePreamble = await Utility.createAzModulePreamble(tempDirectory);

            if (modulePreamble) {
                azShimDirectory = modulePreamble.azShimDirectory;
                contents.push(...modulePreamble.lines);
            }

            let customerScriptPath: string = tl.getPathInput("scriptPath", false, false);

            if (scriptLocation.toLowerCase() === 'inlinescript') {
                const inlineScript: string = tl.getInput("inlineScript", true);

                customerScriptPath = path.join(
                    tempDirectory,
                    `azureclitaskscript${new Date().getTime()}_inlinescript.${fileExtensions[0]}`
                );

                await Utility.createFile(customerScriptPath, inlineScript);
            } else if (!Utility.checkIfFileExists(customerScriptPath, fileExtensions)) {
                throw new Error(tl.loc('JS_InvalidFilePath', customerScriptPath));
            }

            let invocation = `. '${customerScriptPath.replace(/'/g, "''")}' `;
            if (scriptArguments) {
                invocation += scriptArguments;
            }
            contents.push(invocation.trim());

            const powerShellIgnoreLASTEXITCODE = tl.getBoolInput('powerShellIgnoreLASTEXITCODE', false);
            if (!powerShellIgnoreLASTEXITCODE) {
                contents.push(`if (!(Test-Path -LiteralPath variable:\\LASTEXITCODE)) {`);
                contents.push(`    Write-Host '##vso[task.debug]$LASTEXITCODE is not set.'`);
                contents.push(`} else {`);
                contents.push(`    Write-Host ('##vso[task.debug]$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
                contents.push(`    exit $LASTEXITCODE`);
                contents.push(`}`);
            }

            wrapperScriptPath = path.join(
                tempDirectory,
                `azureclitaskscript${new Date().getTime()}.${fileExtensions[0]}`
            );

            await Utility.createFile(wrapperScriptPath, '\ufeff' + contents.join(os.EOL), { encoding: 'utf8' });

            return { scriptPath: wrapperScriptPath, azShimDirectory };
        } catch (error) {
            if (wrapperScriptPath) {
                await Utility.deleteFile(wrapperScriptPath);
            }
            if (azShimDirectory) {
                Utility.deleteDirectory(azShimDirectory, 'partialSetup');
            }
            throw error;
        }
    }

    private static async createAzModulePreamble(
        tempDirectory: string
    ): Promise<AzModulePreamble | undefined> {
        const azPath = tl.which('az', false);

        if (!azPath) {
            tl.debug('az not found on PATH; skipping Azure CLI module injection.');
            Utility.emitAzTelemetry('AzModuleInjection', { status: 'skipped', reason: 'az not found on PATH' });
            return undefined;
        }

        const pythonPath = path.join(path.dirname(path.dirname(azPath)), 'python.exe');

        if (!fs.existsSync(pythonPath) || !fs.statSync(pythonPath).isFile()) {
            tl.debug(`python.exe not found at '${pythonPath}'; skipping Azure CLI module injection.`);
            Utility.emitAzTelemetry('AzModuleInjection', { status: 'skipped', reason: 'python.exe not found' });
            return undefined;
        }

        let azShimDirectory: string | undefined;

        try {
            azShimDirectory = fs.mkdtempSync(path.join(tempDirectory, 'azureclitask-az-'));

            const azShimPath = path.join(azShimDirectory, 'az.ps1');
            const escapedPythonPath = pythonPath.replace(/'/g, "''");
            const escapedShimPath = azShimPath.replace(/'/g, "''");

            const shimContents = [
                `$previousInstaller = $env:AZ_INSTALLER`,
                `$azExitCode = 1`,
                `try {`,
                `    $env:AZ_INSTALLER = 'MSI'`,
                `    & '${escapedPythonPath}' -IBm azure.cli @args`,
                `    $azExitCode = $LASTEXITCODE`,
                `}`,
                `finally {`,
                `    if ($null -eq $previousInstaller) {`,
                `        Remove-Item Env:\\AZ_INSTALLER -ErrorAction SilentlyContinue`,
                `    }`,
                `    else {`,
                `        $env:AZ_INSTALLER = $previousInstaller`,
                `    }`,
                `}`,
                `exit $azExitCode`
            ].join(os.EOL);

            await Utility.createFile(azShimPath, '\ufeff' + shimContents, { encoding: 'utf8' });

            Utility.emitAzTelemetry('AzShimCreated', { status: 'created' });

            // Module is named after the shim path so (Get-Command az).Source returns it.
            // Do NOT rename to a human-friendly name — it breaks .Source resolution.
            const lines = [
                `$azureCliTaskShimPath = '${escapedShimPath}'`,
                `$azureCliTaskPythonPath = '${escapedPythonPath}'`,
                `try {`,
                `    $azureCliTaskModule = New-Module -Name $azureCliTaskShimPath -ArgumentList $azureCliTaskPythonPath -ScriptBlock {`,
                `        param([string] $pythonPath)`,
                `        $script:pythonPath = $pythonPath`,
                `        function az {`,
                `            $callerFrame = (Get-PSCallStack)[1].GetFrameVariables()`,
                `            $eapFrame = $callerFrame['ErrorActionPreference']`,
                `            if ($eapFrame) { $ErrorActionPreference = $eapFrame.Value }`,
                `            $nativeFrame = $callerFrame['PSNativeCommandUseErrorActionPreference']`,
                `            if ($nativeFrame) { $PSNativeCommandUseErrorActionPreference = $nativeFrame.Value }`,
                `            $argFrame = $callerFrame['PSNativeCommandArgumentPassing']`,
                `            if ($argFrame) { $PSNativeCommandArgumentPassing = $argFrame.Value }`,
                `            $previousInstaller = $env:AZ_INSTALLER`,
                `            $azExitCode = 1`,
                `            try {`,
                `                $env:AZ_INSTALLER = 'MSI'`,
                `                & $script:pythonPath -IBm azure.cli @args`,
                `                $azExitCode = $LASTEXITCODE`,
                `            }`,
                `            finally {`,
                `                if ($null -eq $previousInstaller) {`,
                `                    Remove-Item Env:\\AZ_INSTALLER -ErrorAction SilentlyContinue`,
                `                }`,
                `                else {`,
                `                    $env:AZ_INSTALLER = $previousInstaller`,
                `                }`,
                `            }`,
                `            $global:LASTEXITCODE = $azExitCode`,
                `        }`,
                `        Export-ModuleMember -Function az`,
                `    }`,
                `    Import-Module -ModuleInfo $azureCliTaskModule -Global -Force`,
                `    $azureCliTaskAzCommand = Get-Command az -CommandType Function -ErrorAction Stop`,
                `    $azureCliTaskAzCommand | Add-Member -NotePropertyName Path -NotePropertyValue $azureCliTaskShimPath -Force`,
                `    Write-Host '##vso[task.debug]Az CLI module injected successfully.'`,
                `} catch {`,
                `    if ($azureCliTaskModule) { Remove-Module -ModuleInfo $azureCliTaskModule -Force -ErrorAction SilentlyContinue }`,
                `    Write-Host "##vso[task.logissue type=warning]Az module preamble failed: $_ - falling back to stock az.cmd"`,
                `}`
            ];

            Utility.emitAzTelemetry('AzModuleInjection', { status: 'prepared' });

            tl.debug('Injected the Azure CLI PowerShell module and safe path fallback.');

            return { azShimDirectory, lines };
        } catch (error) {
            if (azShimDirectory) {
                Utility.deleteDirectory(azShimDirectory, 'setupFailure');
            }
            throw error;
        }
    }

    private static emitAzTelemetry(feature: string, properties: Record<string, string>): void {
        try {
            emitTelemetry('AzureCLIV3', feature, properties);
        } catch (telemetryError) {
            tl.debug(`Unable to emit telemetry: ${telemetryError}`);
        }
    }

    public static deleteDirectory(directoryPath: string, reason: string): void {
        try {
            tl.rmRF(directoryPath);
            Utility.emitAzTelemetry('AzShimCleanup', { status: 'removed', reason });
        } catch (error) {
            Utility.emitAzTelemetry('AzShimCleanup', {
                status: 'failed',
                reason,
                error: error && error.message ? error.message : String(error)
            });
            tl.warning(`Failed to remove shim directory '${directoryPath}': ${error && error.message ? error.message : String(error)}`);
        }
    }
}
