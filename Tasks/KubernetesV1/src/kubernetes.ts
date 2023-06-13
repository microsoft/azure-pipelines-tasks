"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";
import * as yaml from 'js-yaml';

import { IsJsonString, getDeploymentMetadata, getManifestFileUrlsFromArgumentsInput, getPublishDeploymentRequestUrl, isDeploymentEntity } from 'azure-pipelines-tasks-kubernetes-common/image-metadata-helper';
import { WebRequest, WebResponse, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
import { getCommandConfigurationFile, getNameSpace, isJsonOrYamlOutputFormatSupported } from "./kubernetescommand";

import ClusterConnection from "./clusterconnection";

import trm = require('azure-pipelines-task-lib/toolrunner');



tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
tl.setResourcePath(path.join( __dirname, '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

var registryType = tl.getInput("containerRegistryType", true);
var command = tl.getInput("command", false);
const environmentVariableMaximumSize = 32766;

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
    displayKubectlVersion(clusterConnection);

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

function displayKubectlVersion(connection: ClusterConnection): void {
    try {
        var command = connection.createCommand();
        command.arg('version');
        command.arg(['-o', 'json']);
        const result = command.execSync({ silent: true } as trm.IExecOptions);
        const resultInJSON = JSON.parse(result.stdout);
        if (resultInJSON.clientVersion && resultInJSON.clientVersion.gitVersion) {
            console.log('==============================================================================');
            console.log('\t\t\t' + tl.loc('KubectlClientVersion') + ': ' + resultInJSON.clientVersion.gitVersion);
            if (resultInJSON.serverVersion && resultInJSON.serverVersion.gitVersion) {
                console.log('\t\t\t' + tl.loc('KubectlServerVersion') + ': ' + resultInJSON.serverVersion.gitVersion);
                console.log('==============================================================================');
            }
            else {
                console.log('\t' + tl.loc('KubectlServerVersion') + ': ' + tl.loc('KubectlServerVerisonNotFound'));
                console.log('==============================================================================');
                tl.debug(tl.loc('UnableToFetchKubectlVersion'));
            }
        }
    } catch (ex) {
            console.log(tl.loc('UnableToFetchKubectlVersion'));
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
            const resultString = result.toString();
            const commandOutputLength = resultString.length;
            if (commandOutputLength > environmentVariableMaximumSize) {
                tl.warning(tl.loc("OutputVariableDataSizeExceeded", commandOutputLength, environmentVariableMaximumSize));
            } else {
                tl.setVariable('KubectlOutput', resultString);
            }

            try {
                const outputFormat: string = tl.getInput("outputFormat", false);
                const isOutputFormatSpecified: boolean = outputFormat && (outputFormat.toLowerCase() === "json" || outputFormat.toLowerCase() === "yaml");
                // The deployment data is pushed to evidence store only for commands like 'apply' or 'create' which support Json and Yaml output format
                if (isOutputFormatSpecified && isJsonOrYamlOutputFormatSupported(command)) {
                    let podsOutputString: string = "";
                    try {
                        podsOutputString = getAllPods(clusterConnection).stdout;
                    }
                    catch (e) {
                        tl.debug("Not pushing metadata to artifact metadata store as failed to retrieve container pods; Error: " + e);
                        return;
                    }

                    if (!IsJsonString(podsOutputString)) {
                        tl.debug("Not pushing metadata to artifact metadata store as failed to retrieve container pods");
                    }
                    else {
                        const allPods = JSON.parse(podsOutputString);
                        const clusterInfo = getClusterInfo(clusterConnection).stdout;

                        let fileArgs = "";
                        const configFilePathArgs = getCommandConfigurationFile();
                        if (configFilePathArgs.length > 0) {
                            fileArgs = configFilePathArgs.join(" ");
                        }
                        else {
                            fileArgs = tl.getInput("arguments", false);
                        }

                        const manifestUrls = getManifestFileUrlsFromArgumentsInput(fileArgs);
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
                                    pushDeploymentDataToEvidenceStore(clusterConnection, parsedObject, allPods, clusterInfo, manifestUrls).then((result) => {
                                        tl.debug("DeploymentDetailsApiResponse: " + JSON.stringify(result));
                                    }, (error) => {
                                        tl.warning("publishToImageMetadataStore failed with error: " + error);
                                    });
                                }
                                catch (e) {
                                    tl.warning("pushDeploymentDataToEvidenceStore failed with error: " + e);
                                }
                            }
                        });
                    }
                }
            }
            catch (e) {
                tl.warning("Capturing deployment metadata failed with error: " + e)
            }
        });
}

async function pushDeploymentDataToEvidenceStore(clusterConnection: ClusterConnection, deploymentObject: any, allPods: any, clusterInfo: string, manifestUrls: string[]): Promise<any> {
    const metadata = getDeploymentMetadata(deploymentObject, allPods, "None", clusterInfo, manifestUrls);
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
