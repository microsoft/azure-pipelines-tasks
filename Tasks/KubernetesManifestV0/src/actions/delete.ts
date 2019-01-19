"use strict"; 

import tl = require('vsts-task-lib/task'); 
import { Kubectl } from "utility-common/kubectl-object-model"; 
import kubectlutility = require("utility-common/kubectlutility"); 

const TASK_INPUT_DELETE_BY_FILENAME = "filenames";
const TASK_INPUT_DELETE_BY_RESOURCES_AND_NAMES = "resourcesAndNames";
const TASK_INPUT_DELETE_BY_RESOURCES_AND_LABEL_SELECTORS = "resourcesAndLabelSelector";

export async function deleteResources() {
    let files: string[] = null;
    let names: string[] = null;
    let labels: string = null;
    let deleteResourcesBy = tl.getInput("deleteResourcesBy", true);
    if (deleteResourcesBy == TASK_INPUT_DELETE_BY_FILENAME)
    {
        files = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), tl.getInput("manifestsToDelete", true));
        if (files.length == 0) {
            throw (tl.loc("ManifestFileNotFound"));
        }
    }

    let kubectl = new Kubectl(await getKubectl(), tl.getInput("namespace", false));
    let types = tl.getInput("kinds", true); // kubectl delete pod,service
    
    if (deleteResourcesBy == TASK_INPUT_DELETE_BY_RESOURCES_AND_NAMES){
        names = tl.getDelimitedInput("names", ",", false); // kubectl delete pods, services baz foo
    }
    if (deleteResourcesBy == TASK_INPUT_DELETE_BY_RESOURCES_AND_LABEL_SELECTORS){
        labels = tl.getInput("labels", false); // kubectl delete pods,services -l name=myLabel
    }
    let cascade = tl.getBoolInput("cascade", false); // kubectl delete deployment sample-deployment --cascade=true
    let gracePeriod = tl.getInput("gracePeriod", false); // kubectl delete deployment --grace-period=1
    kubectl.delete(files, types, names, labels, cascade, gracePeriod);
}

async function getKubectl(): Promise<string> {
    try {
        return Promise.resolve(tl.which("kubectl", true));
    } catch (ex) {
        return kubectlutility.downloadKubectl(await kubectlutility.getStableKubectlVersion());
    }
}