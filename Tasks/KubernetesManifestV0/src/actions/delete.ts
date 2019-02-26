"use strict";
import fs = require("fs");
import tl = require('vsts-task-lib/task');
import yaml = require('js-yaml');
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';
import { Kubectl } from "utility-common/kubectl-object-model";
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

export async function deleteResources() {

    let argsPrefix: string;
    
    if(TaskInputParameters.useManifests)
    {
        var files = getManifestFiles();
        if (!!files && files.length > 0) {
            if (isCanaryDeploymentStrategy()) {
                tl.debug("Strategy is canary deployment. So will delete canary objects");
                argsPrefix = createCanaryObjectsArgumentString(files);
            }
            else {
                tl.debug("Strategy is not canary deployment. So will delete all objects declared in file");
                var filePaths = createInlineArray(files);
                argsPrefix = "-f " + filePaths;
            }
        }
    }

    let args = getDeleteCmdArgs(argsPrefix, TaskInputParameters.args);
    tl.debug("Delete cmd args : "+args);
    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    var result = kubectl.delete(args);
    utils.checkForErrors([result]);
}

function getManifestFiles(): string[] {
    if (!TaskInputParameters.manifestsToDelete ||  TaskInputParameters.manifestsToDelete.trim().length == 0)
    {
        tl.debug("file input is not present");
        return null;
    }

    var manifestsToDelete = TaskInputParameters.manifestsToDelete.trim();
    tl.debug("file input is present : "+manifestsToDelete);
    tl.debug("Finding matching files");
    var files = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), manifestsToDelete);

    return files;
}

function isCanaryDeploymentStrategy() {
    var deploymentStrategy = TaskInputParameters.deploymentStrategy;
    return deploymentStrategy && deploymentStrategy.toUpperCase() === "CANARY";
}

function createCanaryObjectsArgumentString(files: string[]) {
    let kindList = new Set();
    let nameList = new Set();

    files.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {
            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            if (canaryDeploymentHelper.isDeploymentEntity(kind)) {
                var canaryObjectName = canaryDeploymentHelper.getCanaryResourceName(name);
                var baselineObjectName = canaryDeploymentHelper.getBaselineResourceName(name);
                kindList.add(kind);
                nameList.add(canaryObjectName);
                nameList.add(baselineObjectName);
            }
        });
    });

    var args = createKubectlArgs(kindList, nameList);
    return args;
}

function createKubectlArgs(kinds: Set<string>, names: Set<string>): string {
    let args = "";
    if (!!kinds && kinds.size > 0) {
        args = args + createInlineArray(Array.from(kinds.values()));
    }

    if (!!names && names.size > 0) {
        args = args + " " + Array.from(names.values()).join(" ")
    }

    return args;
}

function createInlineArray(str: string | string[]): string {
    if (typeof str === "string") return str;
    return str.join(",");
}

function getDeleteCmdArgs(argsPrefix: string, inputArgs: string): string {
    let args = "";

    if (!!argsPrefix && argsPrefix.length > 0) {
        args = argsPrefix;
    }

    if (!!inputArgs && inputArgs.length > 0) {
        if (args.length > 0) {
            args = args + " ";
        }

        args = args + inputArgs;
    }

    return args;
}