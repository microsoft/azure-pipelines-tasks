import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "vsts-task-lib/toolrunner";
import basecommand from "./basecommand"

export default class helmcli extends basecommand {

    private command : string;
    private argument : string;
    private kubeconfigPath : string;

    constructor(kubeconfigPath: string) {
        super();
        this.kubeconfigPath = kubeconfigPath;
    }
    
    public getTool(): string {
        return "helm";
    }

    public login(): void {
        process.env["KUBECONFIG"] = this.kubeconfigPath;
    }

    public logout(): void  {
        delete process.env["KUBECONFIG"];
    }

    public setCommand(command: string): void {
        this.command = command;
    }

    public getCommand(): string {
        return this.command;
    }

    public setArgument(argument: string): void {
        this.argument = argument;
    }

    public getArgument(): string {
        return this.argument;
    }

    public execHelmCommand() : void {
        var command = this.createCommand();
        command.arg(this.command);
        command.line(this.argument);
        this.execCommandSync(command);
    }
}