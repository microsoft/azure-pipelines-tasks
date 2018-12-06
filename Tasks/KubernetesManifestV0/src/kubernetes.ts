"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import ClusterConnection from "./connections/clusterconnection";
import { deploy } from "./actions/deploy";
import { bake } from "./actions/bake";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));


let action = tl.getInput("action");
switch (action) {
    case "bake":
        bake();
        break;
    case "deploy":
        var kubeconfigfilePath = tl.getVariable("KUBECONFIG");
        // open kubectl connection and run the command
        var connection = new ClusterConnection(kubeconfigfilePath);
        connection.open()
            .then(() => deploy(connection))
            .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
            .catch((error) => {
                tl.setResult(tl.TaskResult.Failed, error.message)
                connection.close(!!kubeconfigfilePath);
            });
        break;
    default:
        throw new Error("Not supported");
}
