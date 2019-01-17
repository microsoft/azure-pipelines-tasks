"use strict"; 

import tl = require('vsts-task-lib/task'); 
import { Kubectl } from "utility-common/kubectl-object-model"; 
import kubectlutility = require("utility-common/kubectlutility"); 

export async function deleteResources() {
    let kubectl = new Kubectl(await getKubectl(), tl.getInput("namespace", false));
    let matchOn = tl.getInput("matchOn", true).toLowerCase();
    let kind = tl.getInput("kind", true);
    let name = tl.getInput("name", true);
    let labels = tl.getInput("labels", true);
    let cascadingDelete = tl.getInput("cascadingDelete", true);
    let gracePeriod = tl.getInput("gracePeriod", false);


}

async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}