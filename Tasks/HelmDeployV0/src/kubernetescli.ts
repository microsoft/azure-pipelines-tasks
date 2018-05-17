import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "vsts-task-lib/toolrunner";
import basecommand from "./basecommand"

export default class kubernetescli extends basecommand {

    private kubeconfigPath : string;

    constructor(kubeconfigPath: string) {
        super(true);
        this.kubeconfigPath = kubeconfigPath;
    }
    public getTool(): string {
        return "kubectl";
    }

    public login(): void {
        process.env["KUBECONFIG"] = this.kubeconfigPath;
    }

    public logout(): void  {
        delete process.env["KUBECONFIG"];
    }
}