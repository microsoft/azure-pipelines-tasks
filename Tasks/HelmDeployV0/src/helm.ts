"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as commonCommandOptions from "./commoncommandoption";
import * as helmutil from "./utils"

import { AKSCluster, AKSClusterAccessProfile, AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { WebRequest, WebResponse, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
import { extractManifestsFromHelmOutput, getDeploymentMetadata, getManifestFileUrlsFromHelmOutput, getPublishDeploymentRequestUrl, isDeploymentEntity } from 'azure-pipelines-tasks-kubernetes-common/image-metadata-helper';

import { AzureAksService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"

import fs = require('fs');
import { fail } from 'assert';

const environmentVariableMaximumSize = 32766;

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
tl.setResourcePath(path.join(__dirname, '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));

function getKubeConfigFilePath(): string {
    var userdir = helmutil.getTaskTempDir();
    return path.join(userdir, "config");
}

function getClusterType(): any {
    var connectionType = tl.getInput("connectionType", true);
    var endpoint = tl.getInput("azureSubscriptionEndpoint")
    if (connectionType === "Azure Resource Manager" && endpoint) {
        return require("./clusters/armkubernetescluster")
    }

    return require("./clusters/generickubernetescluster")
}

function isKubConfigSetupRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && command !== "save" && connectionType !== "None";
}

function isKubConfigLogoutRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && command !== "save" && command !== "login" && connectionType !== "None";
}

// get kubeconfig file path
async function getKubeConfigFile(): Promise<string> {
    return getClusterType().getKubeConfig().then((config) => {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath, config);
        fs.chmodSync(configFilePath, '600');
        return configFilePath;
    });
}

function runHelmSaveCommand(helmCli: helmcli, kubectlCli: kubernetescli, failOnStderr: boolean): void {
    if (!helmCli.isHelmV3()) {
        //helm chart save and push commands are only supported in Helms v3  
        throw new Error(tl.loc("SaveSupportedInHelmsV3Only"));
    }
    process.env.HELM_EXPERIMENTAL_OCI="1";
    runHelm(helmCli, "saveChart", kubectlCli, failOnStderr);
    helmCli.resetArguments();
    const chartRef = getHelmChartRef(tl.getVariable("helmOutput"));
    tl.setVariable("helmChartRef", chartRef);
    runHelm(helmCli, "registry", kubectlCli, false);
    helmCli.resetArguments();
    runHelm(helmCli, "pushChart", kubectlCli, failOnStderr);
    helmCli.resetArguments();
    runHelm(helmCli, "removeChart", kubectlCli, failOnStderr);
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
    var failOnStderr = tl.getBoolInput("failOnStderr");

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
            case "save":
                runHelmSaveCommand(helmCli, kubectlCli, failOnStderr);
                break;
            default:
                runHelm(helmCli, command, kubectlCli, failOnStderr);
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

function runHelm(helmCli: helmcli, command: string, kubectlCli: kubernetescli, failOnStderr: boolean) {
    var helmCommandMap = {
        "init": "./helmcommands/helminit",
        "install": "./helmcommands/helminstall",
        "package": "./helmcommands/helmpackage",
        "pushChart": "./helmcommands/helmchartpush",
        "registry": "./helmcommands/helmregistrylogin",
        "removeChart": "./helmcommands/helmchartremove",
        "saveChart": "./helmcommands/helmchartsave",
        "upgrade": "./helmcommands/helmupgrade"
    }

    var commandImplementation = require("./helmcommands/uinotimplementedcommands");
    if (command in helmCommandMap) {
        commandImplementation = require(helmCommandMap[command]);
    }

    //set command
    if (command === "saveChart" || command === "pushChart" || command === "removeChart") {
        helmCli.setCommand("chart");
    } else {
        helmCli.setCommand(command);
    }

    // add arguments
    commonCommandOptions.addArguments(helmCli);
    commandImplementation.addArguments(helmCli);

    const execResult = helmCli.execHelmCommand();
    tl.setVariable('helmExitCode', execResult.code.toString());

    if (execResult.stdout) {
        var commandOutputLength = execResult.stdout.length;
        if (commandOutputLength > environmentVariableMaximumSize) {
            tl.warning(tl.loc('OutputVariableDataSizeExceeded', commandOutputLength, environmentVariableMaximumSize));
        } else {
            tl.setVariable("helmOutput", execResult.stdout);
        }
    }

    var publishPipelineMetadata = tl.getBoolInput("publishPipelineMetadata");

    if (execResult.code != tl.TaskResult.Succeeded || !!execResult.error || (failOnStderr && !!execResult.stderr)) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        tl.setResult(tl.TaskResult.Failed, execResult.stderr);
    }
    else if (publishPipelineMetadata && (command === "install" || command === "upgrade")) {
        try {
            let output = execResult.stdout;
            let releaseName = helmutil.extractReleaseNameFromHelmOutput(output);
            let manifests = helmutil.getManifestsFromRelease(helmCli, releaseName);
            if (manifests && manifests.length > 0) {
                const manifestUrls = getManifestFileUrlsFromHelmOutput(output);
                const allPods = JSON.parse(kubectlCli.getAllPods().stdout);
                const clusterInfo = kubectlCli.getClusterInfo().stdout;

                manifests.forEach(manifest => {
                    //Check if the manifest object contains a deployment entity
                    if (manifest.kind && isDeploymentEntity(manifest.kind)) {
                        try {
                            pushDeploymentDataToEvidenceStore(allPods, clusterInfo, manifest, manifestUrls).then((result) => {
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

async function pushDeploymentDataToEvidenceStore(allPods: any, clusterInfo: any, deploymentObject: any, manifestUrls: string[]): Promise<any> {
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

function getHelmChartRef(helmOutput: string): string {
    const refMarker = "ref:";
    const refIndex = helmOutput.indexOf(refMarker);
    const lineEndingIndex = helmOutput.indexOf("\n", refIndex);
    let helmRef = helmOutput.substring(refIndex + refMarker.length, lineEndingIndex);
    helmRef.trim();
    return helmRef;
}
