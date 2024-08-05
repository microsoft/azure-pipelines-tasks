"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as commonCommandOptions from "./commoncommandoption";
import * as helmutil from "./utils"

import { AKSCluster, AKSClusterAccessProfile, AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { WebRequest, WebResponse, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
import { extractManifestsFromHelmOutput, getDeploymentMetadata, getManifestFileUrlsFromHelmOutput, getPublishDeploymentRequestUrl, isDeploymentEntity } from 'azure-pipelines-tasks-kubernetes-common/image-metadata-helper';

import { AzureAksService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { Kubelogin } from 'azure-pipelines-tasks-kubernetes-common/kubelogin';
import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"

import fs = require('fs');
import { fail } from 'assert';

const environmentVariableMaximumSize = 32766;

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
tl.setResourcePath(path.join(__dirname, '../node_modules/azure-pipelines-tasks-azure-arm-rest/module.json'));

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
        fs.chmodSync(configFilePath, '600');
        return configFilePath;
    });
}

async function run() {
    var command = tl.getInput("command", true).toLowerCase();
    var connectionType = tl.getInput("connectionType", true);
    var isKubConfigRequired = isKubConfigSetupRequired(command);
    var kubectlCli: kubernetescli;
    var externalAuth = connectionType === "None" && (command === "install" || command === "upgrade");
    if (externalAuth && !tl.getVariable("KUBECONFIG")) {
        const kubeConfigPath = path.join(process.env.HOME, '.kube', 'config');
        if (fs.existsSync(kubeConfigPath)) {
            tl.setVariable("KUBECONFIG", kubeConfigPath);
        } else {
            tl.error("KUBECONFIG kube configuration file path must be set when connectionType is none and command is install or upgrade.");
        }
    }
    if (isKubConfigRequired || externalAuth) {
        var kubeconfigfilePath = (command === "logout" || externalAuth) ? tl.getVariable("KUBECONFIG") : await getKubeConfigFile();
        kubectlCli = new kubernetescli(kubeconfigfilePath);
        kubectlCli.login();
    }
  
    const kubelogin = new Kubelogin(helmutil.getTaskTempDir());
    if (kubelogin.isAvailable() && !externalAuth) {
        tl.debug('Kubelogin is installed. Converting kubeconfig.');
        const serviceConnection: string = tl.getInput('azureSubscriptionEndpoint', false);
        try {
            await kubelogin.login(serviceConnection);
        } catch (err) {
            tl.debug(tl.loc('KubeloginFailed', err));
        }
    }

    var helmCli: helmcli = new helmcli();
    helmCli.login();
    var telemetry = {
        connectionType: connectionType,
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID')
    };
    var failOnStderr = tl.getBoolInput("failOnStderr");

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "HelmDeployV1",
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
                await runHelm(helmCli, command, kubectlCli, failOnStderr);
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

async function runHelm(helmCli: helmcli, command: string, kubectlCli: kubernetescli, failOnStderr: boolean): Promise<void> {
    var helmCommandMap = {
        "init": "./helmcommands/helminit",
        "install": "./helmcommands/helminstall",
        "package": "./helmcommands/helmpackage",
        "push": "./helmcommands/helmpush",
        "registry": "./helmcommands/helmregistrylogin",
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
    await commandImplementation.addArguments(helmCli);

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
            tl.error("Capturing deployment metadata failed with error: " + e);
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
