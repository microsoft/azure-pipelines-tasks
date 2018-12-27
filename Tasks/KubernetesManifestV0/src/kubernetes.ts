"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import ClusterConnection from "./connections/clusterconnection";
import { deploy } from "./actions/deploy";
import { bake } from "./actions/bake";

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

function run() {
    let action = tl.getInput("action");
    switch (action) {
        case "bake":
            return bake()
        case "deploy":
            var kubeconfigfilePath = tl.getVariable("KUBECONFIG");
            // open kubectl connection and run the command
            var connection = new ClusterConnection(kubeconfigfilePath);
            return connection.login()
                .then(() => deploy())
                .then(() => connection.close(!kubeconfigfilePath))
        default:
            throw new Error("Not supported");
    }
}

run()
    .catch((error) => tl.setResult(tl.TaskResult.Failed, error.message));