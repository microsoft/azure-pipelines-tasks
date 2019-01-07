"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import { deploy } from "./actions/deploy";
import { bake } from "./actions/bake";
import { Connection } from "./connection";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

function run(): Promise<void> {
    let action = tl.getInput("action");
    switch (action) {
        case "bake":
            return bake()
        case "deploy":
            let connection = new Connection(!!tl.getVariable("KUBECONFIG"))
            return connection.open()
                .then(() => deploy())
                .then(() => connection.close())
        default:
            throw new Error("Not supported");
    }
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));