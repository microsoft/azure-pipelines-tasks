import { PowerShellScriptResult, Utility } from './Utility';
import tl = require("azure-pipelines-task-lib/task");
import os = require("os");
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

export class ScriptTypeFactory {
    public static getSriptType(): ScriptType {
        let scriptType: string = tl.getInput("scriptType", true).toLowerCase();
        let scriptLocation: string = tl.getInput("scriptLocation", true);
        if (!(['inlinescript', 'scriptpath'].find((acceptedValue) => { return scriptLocation.toLowerCase() === acceptedValue; }))) {
            throw new Error(tl.loc('UnacceptedScriptLocationValue', scriptLocation));
        }

        let scriptArguments: string = tl.getInput("scriptArguments", false);
        switch(scriptType){
            case 'ps':
                return new WindowsPowerShell(scriptLocation, scriptArguments);
            case 'pscore':
                return new PowerShellCore(scriptLocation, scriptArguments);
            case 'bash':
                return new Bash(scriptLocation, scriptArguments);
            case 'batch':
            default:
                return new Batch(scriptLocation, scriptArguments);
        }
    }
}

export abstract class ScriptType {

    protected _scriptLocation: string;
    protected _scriptArguments: string;
    protected _scriptPath: string;
    protected _azShimDirectory: string;

    constructor(scriptLocation: string, scriptArguments: string) {
        this._scriptLocation = scriptLocation;
        this._scriptArguments = scriptArguments;
    }

    public abstract getTool(): Promise<any>;

    public async cleanUp(): Promise<void> {
        if(this._scriptLocation.toLowerCase() === 'inlinescript') {
            await Utility.deleteFile(this._scriptPath);
        }
    }

    protected async cleanUpFileInvocationArtifacts(reason: string): Promise<void> {
        if (this._scriptPath) {
            await Utility.deleteFile(this._scriptPath);
            this._scriptPath = undefined;
        }
        if (this._azShimDirectory) {
            const shimDirectory = this._azShimDirectory;
            this._azShimDirectory = undefined;
            Utility.deleteDirectory(shimDirectory, reason);
        }
    }
}

export class WindowsPowerShell extends ScriptType {

    public async getTool(): Promise<any> {
        if (os.platform() === 'win32' && tl.getPipelineFeature('AzureCliUseFileInvocation')) {
            try {
                return await this.getToolWithFileInvocation();
            } catch (err) {
                await this.cleanUpFileInvocationArtifacts('fileInvocationFallback');
                tl.debug(`File invocation failed, falling back to -Command invocation: ${err.message}`);
                try {
                    emitTelemetry('AzureCLIV2', 'FileInvocationFallback', { scriptType: 'ps', error: err.message || String(err) });
                } catch (telErr) {
                    tl.debug(`Unable to emit telemetry: ${telErr}`);
                }
            }
        }

        this._scriptPath = await Utility.getPowerShellScriptPath(this._scriptLocation, ['ps1'], this._scriptArguments);
        let tool: any = tl.tool(tl.which('powershell', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${this._scriptPath.replace(/'/g, "''")}'`);
        return tool;
    }

    private async getToolWithFileInvocation(): Promise<any> {
        const result: PowerShellScriptResult = await Utility.getPowerShellScriptPathWithAzModule(
            this._scriptLocation, ['ps1'], this._scriptArguments
        );

        this._scriptPath = result.scriptPath;
        this._azShimDirectory = result.azShimDirectory;

        let tool: any = tl.tool(tl.which('powershell', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-File')
            .arg(this._scriptPath);
        tl.debug('Using -File invocation for Windows PowerShell to avoid CMD metacharacter issues.');
        return tool;
    }

    public async cleanUp(): Promise<void> {
        await this.cleanUpFileInvocationArtifacts('taskCleanup');
    }
}

export class PowerShellCore extends ScriptType {

    public async getTool(): Promise<any> {
        if (os.platform() === 'win32' && tl.getPipelineFeature('AzureCliUseFileInvocation')) {
            try {
                return await this.getToolWithFileInvocation();
            } catch (err) {
                await this.cleanUpFileInvocationArtifacts('fileInvocationFallback');
                tl.debug(`File invocation failed, falling back to -Command invocation: ${err.message}`);
                try {
                    emitTelemetry('AzureCLIV2', 'FileInvocationFallback', { scriptType: 'pscore', error: err.message || String(err) });
                } catch (telErr) {
                    tl.debug(`Unable to emit telemetry: ${telErr}`);
                }
            }
        }

        this._scriptPath = await Utility.getPowerShellScriptPath(this._scriptLocation, ['ps1'], this._scriptArguments);
        let tool: any = tl.tool(tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${this._scriptPath.replace(/'/g, "''")}'`);
        return tool;
    }

    private async getToolWithFileInvocation(): Promise<any> {
        const result: PowerShellScriptResult = await Utility.getPowerShellScriptPathWithAzModule(
            this._scriptLocation, ['ps1'], this._scriptArguments
        );

        this._scriptPath = result.scriptPath;
        this._azShimDirectory = result.azShimDirectory;

        let tool: any = tl.tool(tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-File')
            .arg(this._scriptPath);
        tl.debug('Using -File invocation for PowerShell Core to avoid CMD metacharacter issues.');
        return tool;
    }

    public async cleanUp(): Promise<void> {
        await this.cleanUpFileInvocationArtifacts('taskCleanup');
    }
}

export class Bash extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Utility.getScriptPath(this._scriptLocation, ['sh']);
        let tool: any = tl.tool(tl.which("bash", true));
        tool.arg(this._scriptPath);
        tool.line(this._scriptArguments); // additional scriptArguments should always call line. line() parses quoted arg strings
        return tool;
    }
}

export class Batch extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Utility.getScriptPath(this._scriptLocation, ['bat', 'cmd']);
        let tool: any = tl.tool(tl.which(this._scriptPath, true));
        tool.line(this._scriptArguments); // additional scriptArguments should always call line. line() parses quoted arg strings
        return tool;
    }
}