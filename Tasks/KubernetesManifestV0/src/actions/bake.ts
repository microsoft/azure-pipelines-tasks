"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import { getTempDirectory } from "../utilities";
import helmutility = require("utility-common/helmutility");

const uuidV4 = require('uuid/v4');

export async function bake() {
    let renderEngine = tl.getInput("renderEngine", true);
    switch (renderEngine) {
        case "helm":
            await Helm.bake();
            break;
        default:
            throw Error("Unknown render engine");
    }
}

class Helm {
    public static async bake() {
        let helmPath = await helmutility.getHelm();
        let helmCommand = tl.tool(helmPath);
        helmCommand.arg("template");
        helmCommand.arg(tl.getPathInput("chart"))
        let args = tl.getDelimitedInput("overrides", "\n");
        helmCommand.arg(this.setArgs(args));
        var result = helmCommand.execSync();
        if (result.stderr) {
            tl.setResult(tl.TaskResult.Failed, result.stderr);
            return;
        }
        let pathToBakedManifest = this.getTemplatePath(result.stdout);
        tl.setVariable(tl.getInput("manifestsBundle"), pathToBakedManifest);
    }

    private static getTemplatePath(data) {
        var paths = path.join(getTempDirectory(), "baked-template-" + uuidV4() + ".yaml");
        fs.writeFileSync(paths, data)
        return paths;
    }

    private static setArgs(args) {
        var newArgs = [];
        args.forEach(arg => {
            let a = arg.split(":");
            newArgs.push("--set")
            newArgs.push(a[0].trim() + "=" + a[1].trim());
        });
        return newArgs;
    }
}