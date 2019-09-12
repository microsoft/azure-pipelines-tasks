"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as yaml from 'js-yaml';

import ClusterConnection from "./clusterconnection";
import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";
import { getNameSpace, isJsonOrYamlOutputFormatSupported } from "./kubernetescommand";
import trm = require('azure-pipelines-task-lib/toolrunner');
import { getDeploymentMetadata, IsJsonString, getPublishDeploymentRequestUrl, isDeploymentEntity, getManifestFilePathsFromArgumentsInput } from 'kubernetes-common-v2/image-metadata-helper';
import { WebRequest, WebResponse, sendRequest } from 'utility-common-v2/restutilities';

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

var registryType = tl.getInput("containerRegistryType", true);
var command = tl.getInput("command", false);
const environmentVariableMaximumSize = 32766;
const publishPipelineMetadata = tl.getVariable("PUBLISH_PIPELINE_METADATA");

var kubeconfigfilePath;
if (command === "logout") {
    kubeconfigfilePath = tl.getVariable("KUBECONFIG");
}
// open kubectl connection and run the command
var connection = new ClusterConnection(kubeconfigfilePath);
try {
    connection.open().then(
        () => { return run(connection, command) }
    ).then(
        () => {
            tl.setResult(tl.TaskResult.Succeeded, "");
            if (command !== "login") {
                connection.close();
            }
        }
        ).catch((error) => {
            tl.setResult(tl.TaskResult.Failed, error.message)
            connection.close();
        });
}
catch (error) {
    tl.setResult(tl.TaskResult.Failed, error.message);
}

async function run(clusterConnection: ClusterConnection, command: string) {
    var secretName = tl.getInput("secretName", false);
    var configMapName = tl.getInput("configMapName", false);

    if (secretName) {
        await kubectlSecret.run(clusterConnection, secretName);
    }

    if (configMapName) {
        await kubectlConfigMap.run(clusterConnection, configMapName);
    }

    if (command) {
        await executeKubectlCommand(clusterConnection, command);
    }
}

function getAllPods(connection: ClusterConnection): trm.IExecSyncResult {
    const command = connection.createCommand();
    command.arg('get');
    command.arg('pods');
    command.arg(['-o', 'json']);
    command.arg(getNameSpace());
    return command.execSync({ silent: true } as trm.IExecOptions);
}

function getClusterInfo(connection: ClusterConnection): trm.IExecSyncResult {
    const command = connection.createCommand();
    command.arg('cluster-info');
    return command.execSync({ silent: true } as trm.IExecOptions);
}

// execute kubectl command
function executeKubectlCommand(clusterConnection: ClusterConnection, command: string): any {
    var commandMap = {
        "login": "./kuberneteslogin",
        "logout": "./kuberneteslogout"
    }

    var commandImplementation = require("./kubernetescommand");
    if (command in commandMap) {
        commandImplementation = require(commandMap[command]);
    }

    var telemetry = {
        registryType: registryType,
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID')
    };

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "KubernetesV1",
        JSON.stringify(telemetry));

    // The output result can contain more than one Json objects
    // We want to parse each of the objects separately, hence push the output in JSON array form    
    var result = [];
    return commandImplementation.run(clusterConnection, command, (data) => result.push(data))
        .fin(function cleanup() {
            console.log("commandOutput" + result);
            var commandOutputLength = result.length;
            if (commandOutputLength > environmentVariableMaximumSize) {
                tl.warning(tl.loc("OutputVariableDataSizeExceeded", commandOutputLength, environmentVariableMaximumSize));
            } else {
                tl.setVariable('KubectlOutput', result.toString());
            }

            const outputFormat: string = tl.getInput("outputFormat", false);
            const isOutputFormatSpecified: boolean = outputFormat && (outputFormat.toLowerCase() === "json" || outputFormat.toLowerCase() === "yaml");
            // The deployment data is pushed to evidence store only for commands like 'apply' or 'create' which support Json and Yaml output format
            if (publishPipelineMetadata && publishPipelineMetadata.toLowerCase() == "true" && isOutputFormatSpecified && isJsonOrYamlOutputFormatSupported(command)) {
                const allPods = JSON.parse(getAllPods(clusterConnection).stdout);
                const clusterInfo = getClusterInfo(clusterConnection).stdout;
                const manifestPaths = getManifestFilePathsFromArgumentsInput();
                // For each output, check if it contains a JSON object
                result.forEach(res => {
                    let parsedObject: any;
                    if (IsJsonString(res)) {
                        parsedObject = JSON.parse(res);
                    }
                    else {
                        parsedObject = yaml.safeLoad(res);
                    }
                    // Check if the output contains a deployment
                    if (parsedObject.kind && isDeploymentEntity(parsedObject.kind)) {
                        try {
                            pushDeploymentDataToEvidenceStore(clusterConnection, parsedObject, allPods, clusterInfo, manifestPaths).then((result) => {
                                tl.debug("DeploymentDetailsApiResponse: " + JSON.stringify(result));
                            }, (error) => {
                                tl.warning("publishToImageMetadataStore failed with error: " + error);
                            });
                        }
                        catch (e) {
                            tl.warning("Capturing deployment metadata failed with error: " + e);
                        }
                    }
                });
            }
        });
}

async function pushDeploymentDataToEvidenceStore(clusterConnection: ClusterConnection, deploymentObject: any, allPods: any, clusterInfo: string, manifestPaths: string[]): Promise<any> {
    const metadata = getDeploymentMetadata(deploymentObject, allPods, "None", clusterInfo, manifestPaths);
    const requestUrl = getPublishDeploymentRequestUrl();
    const request = new WebRequest();
    const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);

    request.uri = requestUrl;
    request.method = 'POST';
    request.body = JSON.stringify(metadata);
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
    };

    tl.debug("requestUrl: " + requestUrl);
    tl.debug("requestBody: " + JSON.stringify(metadata));

    try {
        tl.debug("Sending request for pushing deployment data to Image meta data store");
        const response = await sendRequest(request);
        return response;
    }
    catch (error) {
        tl.debug("Unable to push to deployment details to Artifact Store, Error: " + error);
    }
}
