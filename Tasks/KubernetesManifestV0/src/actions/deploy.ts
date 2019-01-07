"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import * as utils from "./../utilities";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");
import { Kubectl, Resource } from "utility-common/kubectl-object-model";

export async function deploy() {

    var files: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), tl.getInput("manifests", true));

    if (files.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    let containers = tl.getDelimitedInput("containers", "\n");
    files = updateContainerImagesInConfigFiles(files, containers);

    let kubectl = new Kubectl(await getKubectl(), tl.getInput("namespace", false));

    let result = kubectl.apply(files);
    checkForErrors([result]);

    let rolloutStatusResults = [];

    let resourceTypes: Resource[] = kubectl.getResources(result.stdout, recognizedWorkloadTypes);
    resourceTypes.forEach(resource => {
        rolloutStatusResults.push(kubectl.checkRolloutStatus(resource.type, resource.name));
    });
    checkForErrors(rolloutStatusResults);

    let annotateResults: IExecSyncResult[] = [];
    var allPods = JSON.parse((kubectl.getAllPods()).stdout);
    annotateResults.push(kubectl.annotateFiles(files, annotationsToAdd(), true));
    resourceTypes.forEach(resource => {
        if (resource.type.indexOf("pods") == -1)
            annotateChildPods(kubectl, resource.type, resource.name, allPods)
                .forEach(execResult => annotateResults.push(execResult));
    });
    checkForErrors(annotateResults, true);
}

function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
    if (execResults.length != 0) {
        var stderr = "";
        execResults.forEach(result => {
            if (result.stderr) {
                stderr += result.stderr + "\n";
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError)
                tl.warning(stderr.trim());
            else
                throw stderr.trim();
        }
    }
}

function updateContainerImagesInConfigFiles(filePaths: string[], containers): string[] {
    if (containers != []) {
        let newFilePaths = [];
        const tempDirectory = utils.getTempDirectory();
        filePaths.forEach((filePath: string) => {
            var contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(":")[0] + ":";
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

        return newFilePaths;
    }

    return filePaths;
}

function replaceAllTokens(currentString: string, replaceToken, replaceValue) {
    let i = currentString.indexOf(replaceToken);
    if (i < 0) {
        tl.debug(`No occurence of replacement token: ${replaceToken} found`);
        return currentString;
    }

    let newString = currentString.substring(0, i);
    let leftOverString = currentString.substring(i);
    newString += replaceValue + leftOverString.substring(Math.min(leftOverString.indexOf("\n"), leftOverString.indexOf("\"")));
    if (newString == currentString) {
        tl.debug(`All occurences replaced`);
        return newString;
    }
    return replaceAllTokens(newString, replaceToken, replaceValue);
}

function annotateChildPods(kubectl: Kubectl, resourceType, resourceName, allPods): IExecSyncResult[] {
    let commandExecutionResults = [];
    var owner = resourceName;
    if (resourceType.indexOf("deployment") > -1) {
        owner = kubectl.getNewReplicaSet(resourceName);
    }

    if (!!allPods && !!allPods["items"] && allPods["items"].length > 0) {
        allPods["items"].forEach((pod) => {
            let owners = pod["metadata"]["ownerReferences"];
            if (!!owners) {
                owners.forEach(ownerRef => {
                    if (ownerRef["name"] == owner) {
                        commandExecutionResults.push(kubectl.annotate("pod", pod["metadata"]["name"], annotationsToAdd(), true));
                    }
                });
            }
        });
    }

    return commandExecutionResults;
}

async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}

function annotationsToAdd(): string[] {
    return [
        `azure-pipelines/execution=${tl.getVariable("Build.BuildNumber")}`,
        `azure-pipelines/pipeline="${tl.getVariable("Build.DefinitionName")}"`,
        `azure-pipelines/executionuri=${tl.getVariable("System.TeamFoundationCollectionUri")}_build/results?buildId=${tl.getVariable("Build.BuildId")}`,
        `azure-pipelines/project=${tl.getVariable("System.TeamProject")}`,
        `azure-pipelines/org=${tl.getVariable("System.CollectionId")}`
    ];
}

var recognizedWorkloadTypes = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];