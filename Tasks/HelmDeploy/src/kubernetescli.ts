import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "vsts-task-lib/toolrunner";
import basecommand from "./basecommand"

export default class helmcli extends basecommand {

    public getTool(): string {
        return "kubectl";
    }

    public login(): void {

    }

    public logout(): void  {
        
    }
}