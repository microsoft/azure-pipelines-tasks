"use strict";

var fs = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";
import { ToolRunner, IExecOptions, IExecSyncResult } from 'vsts-task-lib/toolrunner';
import kubectlutility = require("utility-common/kubectlutility");
import { Kubectl } from "utility-common/kubectl-object-model";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getNewUserDirPath(): string {
    var userDir = path.join(getTempDirectory(), "kubectlTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
}

export function ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export function assertFileExists(path: string) {
    if (!fs.existsSync(path)) {
        tl.error(tl.loc('FileNotFoundException', path));
        throw new Error(tl.loc('FileNotFoundException', path));
    }
}

export function execCommand(command: ToolRunner, options?: IExecOptions) {
    command.on("errline", tl.error);
    return command.execSync(options);
}

export async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}

export function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
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
            else {
                throw new Error(stderr.trim());
            }
        }
    }
}

export function annotationsToAdd(): string[] {
    return [
        `azure-pipelines/execution=${tl.getVariable("Build.BuildNumber")}`,
        `azure-pipelines/pipeline="${tl.getVariable("Build.DefinitionName")}"`,
        `azure-pipelines/executionuri=${tl.getVariable("System.TeamFoundationCollectionUri")}_build/results?buildId=${tl.getVariable("Build.BuildId")}`,
        `azure-pipelines/project=${tl.getVariable("System.TeamProject")}`,
        `azure-pipelines/org=${tl.getVariable("System.CollectionId")}`
    ];
}


export function annotateChildPods(kubectl: Kubectl, resourceType, resourceName, allPods): IExecSyncResult[] {
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
