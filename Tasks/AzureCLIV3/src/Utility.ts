import tl = require("azure-pipelines-task-lib/task");
import os = require("os");
import path = require("path");
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';
import fs = require("fs");
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

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

        // Bypass az.cmd to preserve special characters (e.g. ^ in passwords)
        // Azure CLI MSI layout: <install>/wbin/az.cmd — go up 2 dirs to find <install>/python.exe
        if (os.platform() === 'win32' && tl.getBoolFeatureFlag('AZP_AZURECLI_USE_FILE_INVOCATION')) {
            const azPath = tl.which('az', false);
            if (azPath) {
                const pythonPath = path.join(path.dirname(path.dirname(azPath)), 'python.exe');
                if (fs.existsSync(pythonPath)) {
                    contents.push(`function az { $env:AZ_INSTALLER = 'MSI'; & '${pythonPath.replace(/'/g, "''")}' -IBm azure.cli @args }`);
                    tl.debug('Injected PowerShell az function alias to bypass az.cmd.');
                    try {
                        emitTelemetry('AzureCLIV3', 'AzFunctionAlias', { status: 'injected' });
                    } catch (telErr) {
                        tl.debug(`Unable to emit telemetry: ${telErr}`);
                    }
                } else {
                    tl.debug(`python.exe not found at '${pythonPath}'; skipping az function alias injection.`);
                    try {
                        emitTelemetry('AzureCLIV3', 'AzFunctionAlias', { status: 'skipped', reason: 'python.exe not found' });
                    } catch (telErr) {
                        tl.debug(`Unable to emit telemetry: ${telErr}`);
                    }
                }
            } else {
                tl.debug('az not found on PATH; skipping az function alias injection.');
                try {
                    emitTelemetry('AzureCLIV3', 'AzFunctionAlias', { status: 'skipped', reason: 'az not found on PATH' });
                } catch (telErr) {
                    tl.debug(`Unable to emit telemetry: ${telErr}`);
                }
            }
        }

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
}
