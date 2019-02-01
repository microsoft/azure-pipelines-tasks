"use strict"; 

import tl = require('vsts-task-lib/task'); 
import { Kubectl } from "utility-common/kubectl-object-model"; 
import * as utils from "../utils/utilities";
import * as TaskInputParameters from '../models/TaskInputParameters';

const TASK_INPUT_DELETE_BY_FILENAME = "filenames";
const TASK_INPUT_DELETE_BY_RESOURCES_AND_NAMES = "resourcesAndNames";
const TASK_INPUT_DELETE_BY_RESOURCES_AND_LABEL_SELECTORS = "resourcesAndLabelSelector";

export async function deleteResources() {
    let files: string[] = null;
    let names: string[] = null;
    let labels: string = null;
    let deleteResourcesBy = TaskInputParameters.deleteResourcesBy;
    
    if (deleteResourcesBy == TASK_INPUT_DELETE_BY_FILENAME)
    {
        files = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), TaskInputParameters.manifestsToDelete);
        if (files.length == 0) {
            throw (tl.loc("ManifestFileNotFound"));
        }
    }

    let kubectl = new Kubectl(await utils.getKubectl(), TaskInputParameters.namespace);
    let types = TaskInputParameters.kinds // kubectl delete pod,service
    
    if (deleteResourcesBy === TASK_INPUT_DELETE_BY_RESOURCES_AND_NAMES){
        names = TaskInputParameters.names // kubectl delete pods, services baz foo
    }
    if (deleteResourcesBy === TASK_INPUT_DELETE_BY_RESOURCES_AND_LABEL_SELECTORS){
        labels = TaskInputParameters.labels; // kubectl delete pods,services -l name=myLabel
    }
    let cascade = TaskInputParameters.cascade; // kubectl delete deployment sample-deployment --cascade=true
    let gracePeriod = TaskInputParameters.gracePeriod; // kubectl delete deployment --grace-period=1
    var result = kubectl.delete(files, types, names, labels, cascade, gracePeriod);
    utils.checkForErrors([result]);
}