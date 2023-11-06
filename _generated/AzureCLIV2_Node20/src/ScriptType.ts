import { Utility } from './Utility';
import tl = require("azure-pipelines-task-lib/task");

export class ScriptTypeFactory {
    public static getSriptType(): ScriptType {
        let scriptType: string = tl.getInput("scriptType", true);
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
}

export class WindowsPowerShell extends ScriptType {

    public async getTool(): Promise<any> {
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

    public async cleanUp(): Promise<void> {
        await Utility.deleteFile(this._scriptPath);
    }
}

export class PowerShellCore extends ScriptType {

    public async getTool(): Promise<any> {
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

    public async cleanUp(): Promise<void> {
        await Utility.deleteFile(this._scriptPath);
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