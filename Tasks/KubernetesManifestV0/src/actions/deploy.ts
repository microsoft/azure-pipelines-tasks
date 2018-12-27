"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import * as utils from "./../utilities";
import Q = require('q');
import { IExecOptions } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");

var kubectlPath = "";
var annotationPromises = [];

export async function deploy() {
    annotationPromises = [];
    let containers = tl.getDelimitedInput("containers", "\n");
    let files = getCommandConfigurationFiles(tl.getInput("manifests", true), containers);
    if (files === []) {
        throw ("No file found with matching pattern");
    }

    for (let i = 0; i < files.length; i++) {
        let filePath = files[i];
        let results = await apply(filePath);
        if (results.stderr) {
            tl.setResult(tl.TaskResult.Failed, results.stderr);
            break;
        }
        var types = results.stdout.split("\n");
        annotationPromises = [annotate(filePath)];
        if (tl.getBoolInput("checkManifestStability")) {
            types.forEach(line => {
                let words = line.split(" ");
                if (recognizedWorkloadTypes.filter(type => words[0].startsWith(type)).length > 0) {
                    annotationPromises.push(checkRolloutStatus(words[0], words[1].trim()));
                }
            });
        }
        types.forEach(line => {
            let words = line.split(" ");
            if (recognizedWorkloadTypes.filter(type => words[0].startsWith(type)).length > 0) {
                annotateResourceSets(words[0], words[1].trim());
            }
        });

    }
    if (annotationPromises.length != 0) {
        let results = await Q.all(annotationPromises);
        let sum = results.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            tl.setResult(tl.TaskResult.Failed, "Annotations failed");
        }
    }
}

function getCommandConfigurationFiles(filePattern: string, containers): string[] {
    if (filePattern.length == 0) {
        return [""];
    }
    var files: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), filePattern);
    if (!files || !files.length) {
        return [];
    }

    if (containers != []) {
        let newFilePaths = [];
        const tempDirectory = utils.getTempDirectory();
        files.forEach((filePath: string) => {
            var contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(":")[0];
                if (contents.indexOf(imageName) > 0) {
                    contents = replaceAllTokens(contents, imageName, container);
                }
            });

            let fileName = path.join(tempDirectory, path.basename(filePath));
            fs.writeFileSync(
                path.join(fileName),
                contents
            );

            newFilePaths.push(fileName);
        });
    }

    return files;
}

function replaceAllTokens(currentString: string, replaceToken, replaceValue) {
    let i = currentString.indexOf(replaceToken);
    if (i < 0) {
        return currentString;
    }

    let newString = currentString.substring(0, i);
    let leftOverString = currentString.substring(i);
    newString += replaceValue + leftOverString.substring(Math.min(leftOverString.indexOf("\n"), leftOverString.indexOf("\"")));
    if (newString == currentString) {
        return newString;
    }
    return replaceAllTokens(newString, replaceToken, replaceValue);
}

async function apply(configurationPath: string) {
    var command = tl.tool(await getKubectl());
    command.arg("apply");
    command.arg(getNameSpace());
    command.arg(["-f", configurationPath]);
    return command.execSync();
}

async function annotate(configurationPath?: string, podName?: string) {
    var command = tl.tool(await getKubectl());
    command.arg("annotate");
    command.arg(getNameSpace());
    if (!!configurationPath) command.arg(["-f", configurationPath]);
    if (!!podName) command.arg(["pod", podName]);
    command.arg(`azure-pipelines/execution=${tl.getVariable("Build.BuildNumber")}`)
    command.arg(`azure-pipelines/pipeline="${tl.getVariable("Build.DefinitionName")}"`)
    command.arg(`azure-pipelines/executionuri=${tl.getVariable("System.TeamFoundationCollectionUri")}_build/results?buildId=${tl.getVariable("Build.BuildId")}`)
    command.arg(`azure-pipelines/project=${tl.getVariable("System.TeamProject")}`)
    command.arg(`azure-pipelines/org=${tl.getVariable("System.CollectionId")}`)
    command.arg(`--overwrite`)
    return await command.exec();
}

async function annotateResourceSets(type, name) {
    if (type.indexOf("pod") > -1) {
        return;
    }

    var owner = name;
    if (type.indexOf("deployment") > -1) {
        owner = getNewReplicaSet(name);
    }

    var allPods = JSON.parse((await getAllPods()).stdout);
    if (!!allPods && !!allPods["items"] && allPods["items"].length > 0) {
        allPods["items"].forEach((pod) => {
            let owners = pod["metadata"]["ownerReferences"];
            if (!!owners) {
                owners.forEach(ownerRef => {
                    if (ownerRef["name"] == owner) {
                        annotationPromises.push(annotate(null, pod["metadata"]["name"]));
                    }
                });
            }
        });
    }
}

async function getNewReplicaSet(deployment) {
    var command = tl.tool(await getKubectl());
    command.arg("describe");
    command.arg(getNameSpace());
    command.arg(["deployment", deployment]);
    let stdout = command.execSync({ silent: true } as IExecOptions).stdout.split("\n");
    let newReplicaSet = "";
    stdout.forEach((line: string) => {
        if (line.indexOf("newreplicaset") > -1) {
            newReplicaSet = line.substr(14).trim().split(" ")[0];
        }
    });

    return newReplicaSet;
}

async function getAllPods() {
    var command = tl.tool(await getKubectl());
    command.arg("get");
    command.arg(getNameSpace());
    command.arg("pods");
    command.arg(["-o", "json"])
    return command.execSync({ silent: true } as IExecOptions);
}

function getNameSpace(): string[] {
    var args: string[] = [];
    var namespace = tl.getInput("namespace", false);
    if (namespace) {
        args[0] = "-n";
        args[1] = namespace;
    }

    return args;
}

async function checkRolloutStatus(resourceType, name) {
    var command = tl.tool(await getKubectl());
    command.arg(["rollout", "status"]);
    command.arg(resourceType + "/" + JSON.parse(name));
    command.arg(getNameSpace());
    return command.execSync();
}

var recognizedWorkloadTypes = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];

async function getKubectl(): Promise<string> {
    if (kubectlPath) return Promise.resolve(kubectlPath);

    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        kubectlPath = await kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
        return Promise.resolve(kubectlPath);
    }
}