import * as os from "os";
import * as path from "path";
import Q = require("q");
import util = require("util");

import tl = require('vsts-task-lib/task');
import * as tr from "vsts-task-lib/toolrunner";

import * as definitions from "./definitions";
import dotnetInstaller = require("./install-dotnet");

export class AzCopyWindows implements definitions.IBlobTransferService {
    private _host: AzCopyWindowsHost;

    constructor() {
        this._host = new AzCopyWindowsHost();
    }

    public async uploadBlobs(source: string, destination: string){
        //await this._host.initialize();
        var command = await this._host.createAzCopyTool();
        //command.arg("");
        await this._host.execTool(command);
    }
}

export class AzCopyXplat implements definitions.IBlobTransferService {
    private _host: AzCopyXplatHost;

    constructor() {
        this._host = new AzCopyXplatHost();
    }

    public async uploadBlobs(source: string, destination: string){
        //await this._host.initialize();
        var command = await this._host.createAzCopyTool();
        //command.arg("");
        await this._host.execTool(command);
    }
}

export abstract class AzCopyHost {
    protected azCopyExePath;
    protected getAzCopyPath() {}
    protected async ExecutePreReq() {}

    // public async initialize(): Promise<string> {
    //     if(!this.azCopyExePath) {
    //         this.azCopyExePath = await this.getAzCopyPath();
    //         tl.debug("AzCopy path to be used by task: " + this.azCopyExePath);
    //     }

    //     return this.azCopyExePath;
    // }

    public async createAzCopyTool(): Promise<tr.ToolRunner> {
        if(!this.azCopyExePath) {
            await this.ExecutePreReq();
            this.azCopyExePath = await this.getAzCopyPath();
            tl.debug("AzCopy path to be used by task: " + this.azCopyExePath);
        }

        var command = tl.tool(this.azCopyExePath);
        return command;
    }

    public execTool(command: tr.ToolRunner, options: tr.IExecOptions){
        command.exec(options);
    }
}

export class AzCopyWindowsHost extends AzCopyHost {
    public getAzCopyPath() {

    }

    public execTool(command: tr.ToolRunner){
        super.execTool(command, null);
    }
}

export class AzCopyXplatHost extends AzCopyHost {
    private _coreclrPath: string;
    public getAzCopyPath(): string {
        return path.join(__dirname, "AzCopyXplat");
    }

    public async ExecutePreReq(): Promise<void> {
        var installPath = path.join(__dirname, "coreclr");
        var dotnetPath = await dotnetInstaller.install("1.1.2", null, installPath);
        this._coreclrPath = dotnetPath;
    }

    public execTool(command: tr.ToolRunner){
        if(!!this._coreclrPath) {
            var newPath: string = this._coreclrPath + path.delimiter + process.env['PATH'];
            tl.debug('new Path: ' + newPath);
           process.env['PATH'] = newPath;
        }

        var options: tr.IExecOptions = <tr.IExecOptions>{
            env: process.env
        }

        super.execTool(command, options);
    }
}