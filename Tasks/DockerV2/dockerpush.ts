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

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    var commandArguments = tl.getInput("arguments", false);

    // get tags input
    let tags = tl.getDelimitedInput("tags", "\n");

    // get qualified image name from the containerRegistry input
    let repositoryName = tl.getInput("repository");
    let imageNames: string[] = [];
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName);
    }

    const dockerfilepath = tl.getInput("dockerFile", true);
    const dockerFile = findDockerFile(dockerfilepath);
    if (!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    // push all tags
    let output = "";
    let outputImageName = "";
    let digest = "";
    let promise = pushMultipleImages(connection, imageNames, tags, commandArguments, (image, commandOutput) => {
        output += commandOutput;
        outputImageName = image;
        digest = extractDigestFromOutput(commandOutput);
        tl.debug("outputImageName: " + outputImageName + "\n" + "commandOutput: " + commandOutput + "\n" + "digest:" + digest);
        publishToImageMetadataStore(connection, outputImageName, tags, digest, dockerFile).then((result) => {
            tl.debug("ImageDetailsApiResponse: " + result);
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
    const baseImageName = getBaseImageNameFromDockerFile(dockerFilePath);
     const layers = await dockerCommandUtils.getLayers(connection, imageName);

    // Getting pipeline variables
    const buildId = parseInt(tl.getVariable("Build.BuildId"));
    const buildDefinitionName = tl.getVariable("Build.DefinitionName");
    const buildVersion = tl.getVariable("Build.BuildNumber");
    const buildDefinitionId = tl.getVariable("System.DefinitionId");

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
            "buildId": buildId,
            "buildVersion": buildVersion,
            "buildDefinitionName": buildDefinitionName,
            "buildDefinitionId": buildDefinitionId
        }
    );

    return sendRequestToImageStore(requestBody, requestUrl);
}

function extractDigestFromOutput(dockerPushCommandOutput: string): string {
    // SampleCommandOutput : The push refers to repository [xyz.azurecr.io/acr-helloworld]
    // 3b7670606102: Pushed 
    // e2af85e4b310: Pushed ce8609e9fdad: Layer already exists
    // f2b18e6d6636: Layer already exists
    // 62: digest: sha256:5e3c9cf1692e129744fe7db8315f05485c6bb2f3b9f6c5096ebaae5d5bfbbe60 size: 5718

    // Below regex will extract part after sha256, so expected return value will be 5e3c9cf1692e129744fe7db8315f05485c6bb2f3b9f6c5096ebaae5d5bfbbe60
    const matchPatternForDigest = new RegExp(/sha256\:([\w]+)/);
    const imageMatch = dockerPushCommandOutput.match(matchPatternForDigest);
    if (imageMatch && imageMatch.length >= 1) {
        return imageMatch[1];
    }

    return "";
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


