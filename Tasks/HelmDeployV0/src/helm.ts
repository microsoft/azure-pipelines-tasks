"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as commonCommandOptions from "./commoncommandoption";
import * as helmutil from "./utils"

import { AKSCluster, AKSClusterAccessProfile, AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import { WebRequest, WebResponse, sendRequest } from 'utility-common-v2/restutilities';
import { extractManifestsFromHelmOutput, getDeploymentMetadata, getManifestFileUrlsFromHelmOutput, getPublishDeploymentRequestUrl, isDeploymentEntity } from 'kubernetes-common-v2/image-metadata-helper';

import { AzureAksService } from 'azure-arm-rest-v2/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';
import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"

import fs = require('fs');


tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
tl.setResourcePath(path.join( __dirname, '../node_modules/azure-arm-rest-v2/module.json'));

function getKubeConfigFilePath(): string {
    var userdir = helmutil.getTaskTempDir();
    return path.join(userdir, "config");
}

function getClusterType(): any {
    var connectionType = tl.getInput("connectionType", true);
    if (connectionType === "Azure Resource Manager") {
        return require("./clusters/armkubernetescluster")
    }

    return require("./clusters/generickubernetescluster")
}

function isKubConfigSetupRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && connectionType !== "None";
}

function isKubConfigLogoutRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && command !== "login" && connectionType !== "None";
}

// get kubeconfig file path
async function getKubeConfigFile(): Promise<string> {
    return getClusterType().getKubeConfig().then((config) => {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath, config);
        return configFilePath;
    });
}

async function run() {
    var command = tl.getInput("command", true).toLowerCase();
    var isKubConfigRequired = isKubConfigSetupRequired(command);
    var kubectlCli: kubernetescli;
    if (isKubConfigRequired) {
        var kubeconfigfilePath = command === "logout" ? tl.getVariable("KUBECONFIG") : await getKubeConfigFile();
        kubectlCli = new kubernetescli(kubeconfigfilePath);
        kubectlCli.login();
    }

    var helmCli: helmcli = new helmcli();
    helmCli.login();
    var connectionType = tl.getInput("connectionType", true);
    var telemetry = {
        connectionType: connectionType,
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID')
    };

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "HelmDeployV0",
        JSON.stringify(telemetry));

    try {
        switch (command) {
            case "login":
                kubectlCli.setKubeConfigEnvVariable();
                break;
            case "logout":
                kubectlCli.unsetKubeConfigEnvVariable();
                break;
            default:
                runHelm(helmCli, command, kubectlCli);
        }
    } catch (err) {
        // not throw error so that we can logout from helm and kubernetes
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    finally {
        if (isKubConfigLogoutRequired(command)) {
            kubectlCli.logout();
        }

        helmCli.logout();
    }
}

function runHelm(helmCli: helmcli, command: string, kubectlCli: kubernetescli) {
    var helmCommandMap = {
        "init": "./helmcommands/helminit",
        "install": "./helmcommands/helminstall",
        "package": "./helmcommands/helmpackage",
        "upgrade": "./helmcommands/helmupgrade"
    }

    var commandImplementation = require("./helmcommands/uinotimplementedcommands");
    if (command in helmCommandMap) {
        commandImplementation = require(helmCommandMap[command]);
    }

    //set command
    helmCli.setCommand(command);

    // add arguments
    commonCommandOptions.addArguments(helmCli);
    commandImplementation.addArguments(helmCli);

    const execResult = helmCli.execHelmCommand();
    if (execResult.code != tl.TaskResult.Succeeded || !!execResult.error || !!execResult.stderr) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        tl.setResult(tl.TaskResult.Failed, execResult.stderr);
    }
    else if ((command === "install" || command === "upgrade")) {
        try {
            let output = execResult.stdout;
            let manifests = extractManifestsFromHelmOutput(output);
            if (manifests && manifests.length > 0) {
                const manifestUrls = getManifestFileUrlsFromHelmOutput(output);
                manifests.forEach(manifest => {
                    //Check if the manifest object contains a deployment entity
                    if (manifest.kind && isDeploymentEntity(manifest.kind)) {
                        try {
                            pushDeploymentDataToEvidenceStore(kubectlCli, manifest, manifestUrls).then((result) => {
                                tl.debug("DeploymentDetailsApiResponse: " + JSON.stringify(result));
                            }, (error) => {
                                tl.warning("publishToImageMetadataStore failed with error: " + error);
                            });
                        }
                        catch (e) {
                            tl.warning("publishToImageMetadataStore failed with error: " + e);
                        }
                    }
                });
            }
        }
        catch (e) {
            tl.warning("Capturing deployment metadata failed with error: " + e);
        }
    }
}

run().then(() => {
    // do nothing
}, (reason) => {
    tl.setResult(tl.TaskResult.Failed, reason);
});

async function pushDeploymentDataToEvidenceStore(kubectlCli: kubernetescli, deploymentObject: any, manifestUrls: string[]): Promise<any> {
    const allPods = JSON.parse(kubectlCli.getAllPods().stdout);
    const clusterInfo = kubectlCli.getClusterInfo().stdout;
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

    return Promise.resolve();
}
