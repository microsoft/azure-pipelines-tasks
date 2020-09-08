'use strict';

import { Kubectl } from 'azure-pipelines-tasks-kubernetes-common-v2/kubectl-object-model';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

import * as TaskInputParameters from '../models/TaskInputParameters';
import * as fileHelper from '../utils/FileHelper';
import * as helper from '../utils/KubernetesObjectUtility';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';

export function deployPodCanary(kubectl: Kubectl, filePaths: string[]) {
    const newObjectsList = [];
    const percentage = parseInt(TaskInputParameters.canaryPercentage);

    filePaths.forEach((filePath: string) => {
        const fileContents = fs.readFileSync(filePath);
        yaml.safeLoadAll(fileContents, function (inputObject) {

            const name = inputObject.metadata.name;
            const kind = inputObject.kind;
            if (helper.isDeploymentEntity(kind)) {
                tl.debug('Calculating replica count for canary');
                const canaryReplicaCount = calculateReplicaCountForCanary(inputObject, percentage);
                tl.debug('Replica count is ' + canaryReplicaCount);

                // Get stable object
                tl.debug('Querying stable object');
                const stableObject = canaryDeploymentHelper.fetchResource(kubectl, kind, name);
                if (!stableObject) {
                    tl.debug('Stable object not found. Creating only canary object');
                    // If stable object not found, create canary deployment.
                    const newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    tl.debug('New canary object is: ' + JSON.stringify(newCanaryObject));
                    newObjectsList.push(newCanaryObject);
                } else {
                    tl.debug('Stable object found. Creating canary and baseline objects');
                    // If canary object not found, create canary and baseline object.
                    const newCanaryObject = canaryDeploymentHelper.getNewCanaryResource(inputObject, canaryReplicaCount);
                    const newBaselineObject = canaryDeploymentHelper.getNewBaselineResource(stableObject, canaryReplicaCount);
                    tl.debug('New canary object is: ' + JSON.stringify(newCanaryObject));
                    tl.debug('New baseline object is: ' + JSON.stringify(newBaselineObject));
                    newObjectsList.push(newCanaryObject);
                    newObjectsList.push(newBaselineObject);
                }
            } else {
                // Updating non deployment entity as it is.
                newObjectsList.push(inputObject);
            }
        });
    });

    const manifestFiles = fileHelper.writeObjectsToFile(newObjectsList);
    const result = kubectl.apply(manifestFiles);
    return { 'result': result, 'newFilePaths': manifestFiles };
}

function calculateReplicaCountForCanary(inputObject: any, percentage: number) {
    const inputReplicaCount = helper.getReplicaCount(inputObject);
    return Math.round((inputReplicaCount * percentage) / 100);
}