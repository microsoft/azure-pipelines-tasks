"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import yaml = require('js-yaml');
import * as utils from "./../utilities";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");
import { Kubectl, Resource } from "utility-common/kubectl-object-model";
import * as helper from '../KubernetesObjectHelper';

export async function deploy() {

    var files: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), tl.getInput("manifests", true));

    if (files.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    let containers = tl.getDelimitedInput("containers", "\n");
    files = updateContainerImagesInConfigFiles(files, containers);

    let kubectl = new Kubectl(await getKubectl(), tl.getInput("namespace", false));
    parse(files, kubectl);
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

function parse(filePaths: string[], kubectl: Kubectl) {
    tl.debug("Parsing yaml files");
    var parsedOutput = {};
    var newObjectsList = [];
    filePaths.forEach((filePath: string) => {
        var fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) 
        {
            var canaryMetadata = new helper.CanaryMetdata();
            var name = inputObject.metadata.name;
            var kind = inputObject.kind;
            var canaryReplicaCount = helper.calculateReplicaCountForCanary(inputObject, parseInt(tl.getInput("percentage")));
            if (helper.isDeploymentEntity(kind))
            {
                tl.debug(name+ " is a deployment entity of kind: "+kind);
                tl.debug("Querying stable object");
                canaryMetadata.stable_object = helper.fetchResource(kubectl, kind, name);
                if (!!!canaryMetadata.stable_object ){
                    tl.debug("Stable object not found");
                    tl.debug("Adding input object for creation");
                    newObjectsList.push(inputObject);
                } else {
                tl.debug("Querying canary object");
                canaryMetadata.existing_canary_object = helper.fetchCanaryResource(kubectl, kind, name);
                if (!!!canaryMetadata.existing_canary_object)
                {
                    tl.debug("Canary object not found");
                    var newCanaryObject = helper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    tl.debug("New canary object :"+JSON.stringify(newCanaryObject));
                    var newBaselineObject = helper.getNewBaselineResource(canaryMetadata.stable_object, canaryReplicaCount);
                    tl.debug("Adding canary object for creation");
                    tl.debug("New baseline object :"+JSON.stringify(newBaselineObject));
                    tl.debug("Adding baseline object for creation");
                    newObjectsList.push(newCanaryObject);
                    newObjectsList.push(newBaselineObject);
                }else {

                    //tl.debug("Doing diff of input object and canary object");
                   // var diffCanaryOutput = helper.diff(canaryMetadata.existing_canary_object, inputObject);
                   // tl.debug("Diff output of existing canary and new input is :"+JSON.stringify(diffCanaryOutput));

                    tl.debug("Canary object found");
                    // Update existing canary - Pod spec, Pod metadata, Object labels and replica count
                    tl.debug("Updating existing canary object");
                    helper.updatePodSpec(canaryMetadata.existing_canary_object, helper.getPodSpec(inputObject));
                    helper.updatePodMetdata(canaryMetadata.existing_canary_object, helper.getPodMetdata(inputObject))
                    helper.updateObjectLabelsForCanary(canaryMetadata.existing_canary_object, helper.getObjectLabels(inputObject));
                    helper.updateReplicaCount(canaryMetadata.existing_canary_object, helper.getReplicaCount(inputObject));
                    newObjectsList.push(canaryMetadata.existing_canary_object);

                    tl.debug("Querying baseline object");
                    canaryMetadata.existing_baseline_object = helper.fetchBaselineResource(kubectl, kind, name);
                    if (!!!canaryMetadata.existing_baseline_object){
                        tl.debug("baseline object not found");
                        var newBaselineObject = helper.getNewBaselineResource(canaryMetadata.stable_object, canaryReplicaCount);
                        tl.debug("New baseline object :"+JSON.stringify(newBaselineObject));
                        tl.debug("Adding baseline object for creation");
                        newObjectsList.push(newBaselineObject);
                    }else {
                        // Update existing baseline - Object labels and replica count
                        tl.debug("Updating existing baseline object");
                        helper.updateObjectLabelsForBaseline(canaryMetadata.existing_baseline_object, helper.getObjectLabels(inputObject));
                        helper.updateReplicaCount(canaryMetadata.existing_baseline_object, helper.getReplicaCount(inputObject));
                        newObjectsList.push(canaryMetadata.existing_baseline_object);
                    }
                }

                // Update existing stable - Object labels and replica count
                tl.debug("Updating existing stable object");
                helper.updateObjectLabels(canaryMetadata.stable_object, helper.getObjectLabels(inputObject));
                helper.updateReplicaCount(canaryMetadata.stable_object, helper.getReplicaCount(inputObject));
                newObjectsList.push(canaryMetadata.stable_object);
            }
            }else {
                tl.debug(name+ " is not deployment entity");
            }
        });
        parsedOutput[filePath] = newObjectsList;
        helper.applyResource(kubectl, newObjectsList);

    });
    tl.debug(JSON.stringify(parsedOutput));
    return parsedOutput;
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