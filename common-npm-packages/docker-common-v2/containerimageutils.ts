"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from 'fs';
import ContainerConnection from "./containerconnection";

export function hasRegistryComponent(imageName: string): boolean {
    var periodIndex = imageName.indexOf("."),
        colonIndex = imageName.indexOf(":"),
        slashIndex = imageName.indexOf("/");
    return ((periodIndex > 0 && periodIndex < slashIndex) ||
            (colonIndex > 0 && colonIndex < slashIndex));
}

export function imageNameWithoutTag(imageName: string): string {
    var endIndex = 0;
    if (hasRegistryComponent(imageName)) {
        // Contains a registry component that may include ":", so omit
        // this part of the name from the main delimiter determination
        endIndex = imageName.indexOf("/");
    }
    endIndex = imageName.indexOf(":", endIndex);
    return generateValidImageName(endIndex < 0 ? imageName : imageName.substr(0, endIndex));
}

export function generateValidImageName(imageName: string): string {
    imageName = imageName.toLowerCase();
    imageName = imageName.replace(/ /g,"");
    return imageName;
}

export function getBaseImageNameFromDockerFile(dockerFilePath: string): string {
    const dockerFileContent = fs.readFileSync(dockerFilePath, 'utf-8').toString();
    return getBaseImageName(dockerFileContent);
}

export function getBaseImageName(contents: string): string {
    var lines = contents.split(/[\r?\n]/);
    var i;
    for (i = 0; i < lines.length; i++) {
        var index = lines[i].toUpperCase().indexOf("FROM");
        if (index != -1) {
            var rest = lines[i].substring(index + 4);
            var imageName = rest.trim();
            return imageName;
        }
    }
    
    return null;
}

export function getResourceName(image: string, digest: string) {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/);
    if (!match) {
        return null;
    }

    var registry = match[1];
    var namespace = match[2];
    var repository = match[3];
    var tag = match[4];
  
    if (!namespace && registry && !/[:.]/.test(registry)) {
      namespace = registry
      registry = 'docker.io'
    }

    if (!namespace && !registry) {
      registry = 'docker.io'
      namespace = 'library'
    }

    registry = registry ? registry + '/' : '';
    namespace = namespace ? namespace + '/' : '';
    
    return "https://" + registry  + namespace  + repository + "@sha256:" + digest;
  }

export function getFinalBaseImageName(dockerFilePath: string): string {
    // This method takes into consideration multi-stage dockerfiles, it tries to find the final
    // base image for the container.
    // ex:
    // FROM ubuntu:16.04 as builder
    //
    // FROM builder as base
    // RUN echo 'test'
    //
    // FROM base
    // RUN echo 'test2'
    // 
    // This code is going to return ubuntu:16.04

    try {
        const dockerFileContent = fs.readFileSync(dockerFilePath, 'utf-8');

        if (!dockerFileContent || dockerFileContent == "") {
            return "";
        }

        var lines = dockerFileContent.split(/[\r?\n]/);
        var tagToImageNameMapping: Map<string, string> = new Map<string, string>();
        var baseImage = "";
        for (var i = 0; i < lines.length; i++) {
            var index = lines[i].toUpperCase().indexOf("FROM");
            if (index == -1) {
                continue;
            }

            var nameComponents = lines[i].substring(index + 4).toLowerCase().split(" as ");
            var prospectImageName = nameComponents[0].trim();
            if (nameComponents.length > 1) {
                var tag = nameComponents[1].trim();
                if (tagToImageNameMapping.has(prospectImageName)) {
                    tagToImageNameMapping.set(tag, tagToImageNameMapping.get(prospectImageName));
                } else {
                    tagToImageNameMapping.set(tag, prospectImageName);
                }
                baseImage = tagToImageNameMapping.get(tag);
            } else {
                baseImage = tagToImageNameMapping.has(prospectImageName)
                    ? tagToImageNameMapping.get(prospectImageName)
                    : prospectImageName;
            }
        }
        return baseImage.includes("$") // In this case the base image has an argument and we don't know what it is its real value
            ? ""
            : baseImage;
    } catch (error) {
        tl.debug(`An error was found getting the base image for the docker file ${dockerFilePath}. ${error.message}`);
        return "";
    }
}

export function getImageDigest(connection: ContainerConnection, imageName: string,): string {
    try {
        pullImage(connection, imageName);
        let inspectObj = inspectImage(connection, imageName);

        if (!inspectObj) {
            return "";
        }

        let repoDigests: string[] = inspectObj.RepoDigests;

        if (repoDigests.length == 0) {
            tl.debug(`No digests were found for image: ${imageName}`);
            return "";
        }

        if (repoDigests.length > 1) {
            tl.debug(`Multiple digests were found for image: ${imageName}`);
            return "";
        }

        return repoDigests[0].split("@")[1];
    } catch (error) {
        tl.debug(`An exception was thrown getting the image digest for ${imageName}, the error was ${error.message}`)
        return "";
    }
}

function pullImage(connection: ContainerConnection, imageName: string) {
    let pullCommand = connection.createCommand();
    pullCommand.arg("pull");
    pullCommand.arg(imageName);
    let pullResult = pullCommand.execSync();

    if (pullResult.stderr && pullResult.stderr != "") {
        tl.debug(`An error was found pulling the image ${imageName}, the command output was ${pullResult.stderr}`);
    }
}

function inspectImage(connection: ContainerConnection, imageName): any {
    try {
        let inspectCommand = connection.createCommand();
        inspectCommand.arg("inspect");
        inspectCommand.arg(imageName);
        let inspectResult = inspectCommand.execSync();

        if (inspectResult.stderr && inspectResult.stderr != "") {
            tl.debug(`An error was found inspecting the image ${imageName}, the command output was ${inspectResult.stderr}`);
            return null;
        }

        let inspectObj = JSON.parse(inspectResult.stdout);

        if (!inspectObj || inspectObj.length == 0) {
            tl.debug(`Inspecting the image ${imageName} produced no results.`);
            return null;
        }

        return inspectObj[0];
    } catch (error) {
        tl.debug(`An error ocurred running the inspect command: ${error.message}`);
        return null;
    }
}

