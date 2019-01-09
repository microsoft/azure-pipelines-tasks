"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import { deploy } from "./actions/deploy";
import { bake } from "./actions/bake";
import { scale } from "./actions/scale";
import { patch } from "./actions/patch";
import { Connection } from "./connection";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

function run(): Promise<void> {
    let action = tl.getInput("action");
    if (action === "bake") {
        return bake();
    }
    let connection = new Connection(!!tl.getVariable("KUBECONFIG"));
    let action_func = null;
    switch (action) {
        case "deploy":
            action_func = deploy;
            break;
        case "scale":
            action_func = scale;
            break;
        case "patch":
            action_func = patch;
            break;
        default:
            throw new Error("Not supported");
    }
    return connection.open()
        .then(() => action_func())
        .then(() => connection.close())
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));