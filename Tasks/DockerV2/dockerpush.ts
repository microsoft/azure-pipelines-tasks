"use strict";

import * as tl from "vsts-task-lib/task";
import * as fs from 'fs';
import ContainerConnection from "docker-common/containerconnection";
import * as dockerCommandUtils from "docker-common/dockercommandutils";
import * as utils from "./utils";
import { findDockerFile } from "docker-common/fileutils";
import { WebRequest, WebResponse, sendRequest } from 'utility-common/restutilities';
import { getBaseImageName, getResourceName, getBaseImageNameFromDockerFile } from "docker-common/containerimageutils";

import Q = require('q');

const matchPatternForDigestAndSize = new RegExp(/sha256\:([\w]+)(\s+)size\:\s([\w]+)/);

function pushMultipleImages(connection: ContainerConnection, imageNames: string[], tags: string[], commandArguments: string, onCommandOut: (image, output) => any): any {
    let promise: Q.Promise<void>;
    // create chained promise of push commands
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    let imageNameWithTag = imageName + ":" + tag;
                    tl.debug("Pushing ImageNameWithTag: " + imageNameWithTag);
                    if (promise) {
                        promise = promise.then(() => {
                            return dockerCommandUtils.push(connection, imageNameWithTag, commandArguments, onCommandOut)
                        });
                    }
                    else {
                        promise = dockerCommandUtils.push(connection, imageNameWithTag, commandArguments, onCommandOut);
                    }
                });
            }
            else {
                tl.debug("Pushing ImageName: " + imageName);
                if (promise) {
                    promise = promise.then(() => {
                        return dockerCommandUtils.push(connection, imageName, commandArguments, onCommandOut)
                    });
                }
                else {
                    promise = dockerCommandUtils.push(connection, imageName, commandArguments, onCommandOut);
                }
            }
        });
    }

    // will return undefined promise in case imageNames is null or empty list
    return promise;
}

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): any {
    // ignore the arguments input if the command is buildAndPush, as it is ambiguous
    let commandArguments = isBuildAndPushCommand ? "" : dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    // get tags input
    let tags = tl.getDelimitedInput("tags", "\n");

    // get repository input
    let repositoryName = tl.getInput("repository");
    if (!repositoryName) {
        tl.warning("No repository is specified. Nothing will be pushed.");
    }

    let imageNames: string[] = [];
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName, true);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName, true);
    }

    const dockerfilepath = tl.getInput("dockerFile", true);
    let dockerFile = "";
    if (isBuildAndPushCommand) {
        // For buildAndPush command, to find out the base image name, we can use the
        // Dockerfile returned by findDockerfile as we are sure that this is used
        // for building.
        dockerFile = findDockerFile(dockerfilepath);
        if (!tl.exist(dockerFile)) {
            throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
        }
    }

    // push all tags
    let output = "";
    let outputImageName = "";
    let digest = "";
    let imageSize = "";
    let promise = pushMultipleImages(connection, imageNames, tags, commandArguments, (image, commandOutput) => {
        output += commandOutput;
        outputImageName = image;
        let digest = extractDigestFromOutput(commandOutput, matchPatternForDigestAndSize);
        tl.debug("outputImageName: " + outputImageName + "\n" + "commandOutput: " + commandOutput + "\n" + "digest:" + digest + "imageSize:" + imageSize);
        publishToImageMetadataStore(connection, outputImageName, tags, digest, dockerFile).then((result) => {
            tl.debug("ImageDetailsApiResponse: " + JSON.stringify(result));
        }, (error) => {
            tl.warning("publishToImageMetadataStore failed with error: " + error);
        });
    });

    if (promise) {
        promise = promise.then(() => {
            let taskOutputPath = utils.writeTaskOutput("push", output);
            outputUpdate(taskOutputPath);
        });
    }
    else {
        tl.debug(tl.loc('NotPushingAsNoLoginFound'));
        promise = Q.resolve(null);
    }

    return promise;
}

async function publishToImageMetadataStore(connection: ContainerConnection, imageName: string, tags: string[], digest: string, dockerFilePath: string): Promise<any> {
    // Getting imageDetails
    const imageUri = getResourceName(imageName, digest);
    const baseImageName = dockerFilePath ? getBaseImageNameFromDockerFile(dockerFilePath) : "NA";
    const layers = await dockerCommandUtils.getLayers(connection, imageName);
    if (!layers) {
        return null;
    }
    
    const imageSize = dockerCommandUtils.getImageSize(layers);

    // Getting pipeline variables
    const build = "build";
    const hostType = tl.getVariable("System.HostType").toLowerCase();
    const runId = hostType === build ? parseInt(tl.getVariable("Build.BuildId")) : parseInt(tl.getVariable("Release.ReleaseId"));
    const pipelineVersion = hostType === build ? tl.getVariable("Build.BuildNumber") : tl.getVariable("Release.ReleaseName");
    const pipelineName = tl.getVariable("System.DefinitionName");
    const pipelineId = tl.getVariable("System.DefinitionId");
    const jobName = tl.getVariable("System.PhaseDisplayName");

    const requestUrl = tl.getVariable("System.TeamFoundationCollectionUri") + tl.getVariable("System.TeamProject") + "/_apis/deployment/imagedetails?api-version=5.0-preview.1";
    const requestBody: string = JSON.stringify(
        {
            "imageName": imageUri,
            "imageUri": imageUri,
            "hash": digest,
            "baseImageName": baseImageName,
            "distance": 0,
            "imageType": "",
            "mediaType": "",
            "tags": tags,
            "layerInfo": layers,
            "runId": runId,
            "pipelineVersion": pipelineVersion,
            "pipelineName": pipelineName,
            "pipelineId": pipelineId,
            "jobName": jobName,
            "imageSize": imageSize
        }
    );

    return sendRequestToImageStore(requestBody, requestUrl);
}

function extractDigestFromOutput(dockerPushCommandOutput: string, matchPattern: RegExp): string {
    // SampleCommandOutput : The push refers to repository [xyz.azurecr.io/acr-helloworld]
    // 3b7670606102: Pushed 
    // e2af85e4b310: Pushed ce8609e9fdad: Layer already exists
    // f2b18e6d6636: Layer already exists
    // 62: digest: sha256:5e3c9cf1692e129744fe7db8315f05485c6bb2f3b9f6c5096ebaae5d5bfbbe60 size: 5718

    // Below regex will extract part after sha256, so expected return value will be 5e3c9cf1692e129744fe7db8315f05485c6bb2f3b9f6c5096ebaae5d5bfbbe60
    const imageMatch = dockerPushCommandOutput.match(matchPattern);
    let digest = "";
    if (imageMatch && imageMatch.length >= 1) {
        digest = imageMatch[1];
    }

    return digest;
}

async function sendRequestToImageStore(requestBody: string, requestUrl: string): Promise<any> {
    const request = new WebRequest();
    const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
    request.uri = requestUrl;
    request.method = 'POST';
    request.body = requestBody;
    request.headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
    };

    tl.debug("requestUrl: " + requestUrl);
    tl.debug("requestBody: " + requestBody);
    tl.debug("accessToken: " + accessToken);

    try {
        tl.debug("Sending request for pushing image to Image meta data store");
        const response = await sendRequest(request);
        return response;
    }
    catch (error) {
        tl.debug("Unable to push to Image Details Artifact Store, Error: " + error);
    }

    return Promise.resolve();
}


