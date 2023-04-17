"use strict";

import tl = require('azure-pipelines-task-lib/task');
import * as tr from "azure-pipelines-task-lib/toolrunner";
import path = require('path');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import utils = require("./utils");
import RegistryAuthenticationToken from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";

async function configureBuildctl() {

    tl.debug("configuring buildctl");
    var stableBuildKitVersion = await utils.getStableBuildctlVersion();
    var buildctlPath = await utils.downloadBuildctl(stableBuildKitVersion);

    // prepend the tools path. instructs the agent to prepend for future tasks
    if (!process.env['PATH'].startsWith(path.dirname(buildctlPath))) {
        toolLib.prependPath(path.dirname(buildctlPath));
    }
}

async function verifyBuildctl() {
    var buildctlToolPath = tl.which("buildctl", true);

    if (!buildctlToolPath)
        await configureBuildctl();
    
    tl.debug(tl.loc("VerifyBuildctlInstallation"));

    var buildctlTool = tl.tool(buildctlToolPath);
    var executionOption: tr.IExecOptions = <any>{
        silent: true
    };

    buildctlTool.arg("--help");
    buildctlTool.exec(executionOption);
}

export async function buildctlBuildAndPush() {

    await verifyBuildctl();

    await utils.getBuildKitPod();

    let tags = tl.getDelimitedInput("tags", "\n");
    let endpointId = tl.getInput("dockerRegistryServiceConnection");
    let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);

    // Connect to any specified container registry
    var isPoolProviderContext = process.env["RUNNING_ON"] == "KUBERNETES";
    let connection = new ContainerConnection(!isPoolProviderContext);
    connection.open(null, registryAuthenticationToken, true, false);
    let repositoryName = tl.getInput("repository");
    if (!repositoryName) {
        tl.warning("No repository is specified. Nothing will be pushed.");
    }

    let imageNames: string[] = [];
    if (tl.getInput("dockerRegistryServiceConnection")) {
        let imageName = connection.getQualifiedImageName(repositoryName, true);
        if (imageName) {
            imageNames.push(imageName);
        }
    }

    var dockerfilefolder = tl.getInput("Dockerfile", true);
    if (dockerfilefolder == "Dockerfile") {
        dockerfilefolder = ".";
    }
    else {
        var index = dockerfilefolder.lastIndexOf("Dockerfile");
        dockerfilefolder = dockerfilefolder.substring(0, index);
        tl.debug("Dockerfilefolder path: " + dockerfilefolder);

    }
    var contextarg = "--local=context=" + tl.getInput("buildContext", true);
    var dockerfilearg = "--local=dockerfile=" + dockerfilefolder;
    var buildctlToolPath = tl.which("buildctl", true);
    var buildctlTool = tl.tool(buildctlToolPath);

    buildctlTool.arg("build");
    buildctlTool.arg('--frontend=dockerfile.v0');
    buildctlTool.arg(contextarg);
    buildctlTool.arg(dockerfilearg);
    var imageNameandTag = ""
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(async tag => {
                    if (imageNameandTag)
                    {
                        imageNameandTag += ",";
                    }
                    imageNameandTag += imageName+":"+tag;
                })
            }
            else {
                if (imageNameandTag)
                {
                    imageNameandTag += ",";
                }
                imageNameandTag += imageName;
            }
        })
        buildctlTool.arg('--exporter=image');
        buildctlTool.arg(`--exporter-opt=name=${imageNameandTag}`);
        buildctlTool.arg('--exporter-opt=push=true');
        buildctlTool.exec().then(() => {}).catch((error) => {
            throw new Error(error.message);
        });
    }
    else {
        // only build the image
        await buildctlTool.exec().then(() => {}).catch((error) => {
            throw new Error(error.message);
        });
    }
}