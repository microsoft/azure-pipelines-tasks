"use strict";
import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import ClusterConnection from "../connections/clusterconnection";
import * as utils from "./../utilities";
import Q = require('q');

export function deploy(clusterConnection: ClusterConnection, files?: string[]): any {
    if (!files) {
        let containers = tl.getDelimitedInput("containers", "\n");
        files = getCommandConfigurationFiles(tl.getInput("manifests", true), containers);
        if (files === []) {
            throw ("No file found with matching pattern");
        }
    }

    files.forEach((filePath: string) => {
        let results = apply(filePath);
        annotate(filePath);
        if (tl.getBoolInput("checkManifestStability")) {
            var types = results.stdout.split("\n");
            let promises = [];
            types.forEach(line => {
                let words = line.split(" ");
                if (recognizedType.filter(type => words[0].startsWith(type)).length > 0) {
                    promises.push(checkRolloutStatus(words[0], words[1].trim()));
                }
            });
            Q.all(promises).then(() => {
                console.log("all done")
            })
        }
    });
};

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
                    contents = replaceAll(contents, imageName, container);
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

function replaceAll(currentString: string, replaceToken, replaceValue) {
    let i = currentString.indexOf(replaceToken);
    if (i < 0) {
        return currentString;
    }

    let newString = currentString.substring(0, i);
    let leftOverString = currentString.substring(i);
    newString += replaceValue + leftOverString.substring(leftOverString.indexOf("\n"));
    if (newString == currentString) {
        return newString;
    }
    return replaceAll(newString, replaceToken, replaceValue);
}

function apply(configurationPath: string) {
    var command = tl.tool(tl.which("kubectl"));
    command.arg("apply");
    command.arg(getNameSpace());
    command.arg(["-f", configurationPath]);
    return command.execSync();
}

function annotate(configurationPath: string): any {
    var command = tl.tool(tl.which("kubectl"));
    command.arg("annotate");
    command.arg(getNameSpace());
    command.arg(["-f", configurationPath]);
    command.arg([`Build.BuildId=${tl.getVariable("Build.BuildId")}`])
    command.arg([`Build.Repository.Name=${tl.getVariable("Build.Repository.Name")}`])
    command.arg([`BuildUri=${tl.getVariable("System.TeamFoundationCollectionUri")}_build/results?buildId=${tl.getVariable("Build.BuildId")}`])
    command.arg([`--overwrite`])
    return command.execSync();
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

function checkRolloutStatus(resourceType, name) {
    var command = tl.tool(tl.which("kubectl"));
    command.arg(["rollout", "status"]);
    command.arg(resourceType + "/" + JSON.parse(name));
    command.arg(getNameSpace());
    return command.exec();
}

var recognizedType = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];