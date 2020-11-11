"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as Q from "q";
import ContainerConnection from "./containerconnection";
import * as pipelineUtils from "./pipelineutils";
import * as path from "path";
import * as crypto from "crypto";

const matchPatternForSize = new RegExp(/[\d\.]+/);
const orgUrl = tl.getVariable('System.TeamFoundationCollectionUri');
const buildString = "build";
const hostType = tl.getVariable("System.HostType");
const isBuild = hostType && hostType.toLowerCase() === buildString;
const matchPatternForDigest = new RegExp(/sha256\:(.+)/);

export function build(connection: ContainerConnection, dockerFile: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any {
    var command = connection.createCommand();

    command.arg("build");
    command.arg(["-f", dockerFile]);

    if (labelArguments) {
        labelArguments.forEach(label => {
            command.arg(["--label", label]);
        });
    }

    command.line(commandArguments);

    if (tagArguments) {
        tagArguments.forEach(tagArgument => {
            command.arg(["-t", tagArgument]);
        });
    }

    command.arg(getBuildContext(dockerFile));

    // setup variable to store the command output
    let output = "";
    //In case of BuildKit build, docker tool is sending the logs to stderr.
    command.on(isBuildKitBuild() ? "stderr" : "stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function command(connection: ContainerConnection, dockerCommand: string, commandArguments: string, onCommandOut: (output) => any): any {
    let command = connection.createCommand();
    command.arg(dockerCommand);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(output);
    });
}

export function push(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (image, output) => any): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(image);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(image, output + "\n");
    });
}

export function start(connection: ContainerConnection, container: string, commandArguments: string, onCommandOut: (container, output) => any): any {
    var command = connection.createCommand();
    command.arg("start");
    command.arg(container);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(container, output + "\n");
    });
}

export function stop(connection: ContainerConnection, container: string, commandArguments: string, onCommandOut: (container, output) => any): any {
    var command = connection.createCommand();
    command.arg("stop");
    command.arg(container);
    command.line(commandArguments);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the delegate
        onCommandOut(container, output + "\n");
    });
}

export function getCommandArguments(args: string): string {
    return args ? args.replace(/\n/g, " ") : "";
}

export function getCreatorEmail(): string {
    const schedule = "schedule";
    const buildReason = tl.getVariable("Build.Reason");
    let userEmail: string = "";
    if (isBuild && (!buildReason || buildReason.toLowerCase() !== schedule)) {
        userEmail = tl.getVariable("Build.RequestedForEmail");
    }
    else {
        userEmail = tl.getVariable("Release.RequestedForEmail");
    }

    return userEmail;
}

export function getPipelineLogsUrl(): string {
    let pipelineUrl = "";
    if (isBuild) {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_build/results?buildId=" + tl.getVariable("Build.BuildId");
    }
    else {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_releaseProgress?releaseId=" + tl.getVariable("Release.ReleaseId");
    }

    return pipelineUrl;
}

export function getBuildAndPushArguments(dockerFile: string, labelArguments: string[], tagArguments: string[]): { [key: string]: string } {
    let labelArgumentsString = "";
    let tagArgumentsString = "";
    if (labelArguments && labelArguments.length > 0) {
        labelArgumentsString = labelArguments.join(", ");
    }

    if (tagArguments && tagArguments.length > 0) {
        tagArgumentsString = tagArguments.join(", ");
    }

    let buildArguments = {
        "dockerFilePath": dockerFile,
        "labels": labelArgumentsString,
        "tags": tagArgumentsString,
        "context": getBuildContext(dockerFile)
    };

    return buildArguments;
}

export function getBuildContext(dockerFile: string): string {
    let buildContext = tl.getPathInput("buildContext");
    if (useDefaultBuildContext(buildContext)) {
        buildContext = path.dirname(dockerFile);
    }

    return buildContext;
}

export function useDefaultBuildContext(buildContext: string): boolean {
    let defaultWorkingDir = tl.getVariable("SYSTEM_DEFAULTWORKINGDIRECTORY");
    let defaultPath = path.join(defaultWorkingDir, "**");
    return buildContext === defaultPath;
}

export function getPipelineUrl(): string {
    let pipelineUrl = "";
    const pipelineId = tl.getVariable("System.DefinitionId");
    if (isBuild) {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_build?definitionId=" + pipelineId;
    }
    else {
        pipelineUrl = orgUrl + tl.getVariable("System.TeamProject") + "/_release?definitionId=" + pipelineId;
    }

    return pipelineUrl;
}

export function getLayers(history: string): { [key: string]: string }[] {
    var layers = [];
    if (!history) {
        return null;
    }

    var lines = history.split(/[\r?\n]/);
    lines.forEach(line => {
        line = line.trim();
        if (line.length != 0) {
            layers.push(parseHistoryForLayers(line));
        }
    });

    return layers.reverse();
}

export function getImageFingerPrintV1Name(history: string): string {
    let v1Name = "";
    if (!history) {
        return null;
    }

    const lines = history.split(/[\r?\n]/);
    if (lines && lines.length > 0) {
        v1Name = parseHistoryForV1Name(lines[0]);
    }

    return v1Name;
}

export function getImageSize(layers: { [key: string]: string }[]): string {
    let imageSize = 0;
    for (const layer of layers) {
        for (let key in layer) {
            if (key.toLowerCase() === "size") {
                const layerSize = extractSizeInBytes(layer[key]);
                imageSize += layerSize;
            }
        }
    }

    return imageSize.toString() + "B";
}

export function extractSizeInBytes(size: string): number {
    const sizeStringValue = size.match(matchPatternForSize);
    if (sizeStringValue && sizeStringValue.length > 0) {
        const sizeIntValue = parseFloat(sizeStringValue[0]);
        const sizeUnit = size.substring(sizeIntValue.toString().length);
        switch (sizeUnit.toLowerCase()) {
            case "b": return sizeIntValue;
            case "kb": return sizeIntValue * 1024;
            case "mb": return sizeIntValue * 1024 * 1024;
            case "gb": return sizeIntValue * 1024 * 1024 * 1024;
            case "tb": return sizeIntValue * 1024 * 1024 * 1024 * 1024;
            case "pb": return sizeIntValue * 1024 * 1024 * 1024 * 1024 * 1024;
        }
    }

    return 0;
}

function parseHistoryForLayers(input: string) {
    const NOP = '#(nop)';
    let directive = "UNSPECIFIED";
    let argument = "";
    let index: number = input.indexOf(NOP);
    const createdByMatch = "; createdBy:";
    const indexCreatedBy = input.indexOf(createdByMatch);
    if (index != -1) {
        argument = input.substr(index + 6).trim();
        directive = argument.substr(0, argument.indexOf(' '));
        argument = argument.substr(argument.indexOf(' ') + 1).trim();
    }
    else {
        directive = 'RUN';
        argument = input.substring(indexCreatedBy + createdByMatch.length, input.length - 1);
    }

    const layerIdMatch = "; layerId:";
    const indexLayerId = argument.indexOf(layerIdMatch);
    if (indexLayerId >= 0) {
        argument = argument.substring(0, indexLayerId);
    }

    let createdAt: string = "";
    let layerSize: string = "";
    const createdAtMatch = "createdAt:";
    const layerSizeMatch = "; layerSize:";
    const indexCreatedAt = input.indexOf(createdAtMatch);
    const indexLayerSize = input.indexOf(layerSizeMatch);
    if (indexCreatedAt >= 0 && indexLayerSize >= 0) {
        createdAt = input.substring(indexCreatedAt + createdAtMatch.length, indexLayerSize);
        layerSize = input.substring(indexLayerSize + layerSizeMatch.length, indexCreatedBy);
    }

    return { "directive": directive, "arguments": argument, "createdOn": createdAt, "size": layerSize };
}

function parseHistoryForV1Name(topHistoryLayer: string): string {
    let v1Name = "";
    const layerIdString = "layerId:sha256:";
    const indexOfLayerId = topHistoryLayer.indexOf(layerIdString);
    if (indexOfLayerId >= 0) {
        v1Name = topHistoryLayer.substring(indexOfLayerId + layerIdString.length);
    }

    return v1Name;
}

export async function getHistory(connection: ContainerConnection, image: string): Promise<string> {
    var command = connection.createCommand();
    command.arg("history");
    command.arg(["--format", "createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}}"]);
    command.arg("--no-trunc");
    command.arg(image);

    const defer = Q.defer();
    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    try {
        connection.execCommand(command).then(() => {
            defer.resolve();
        });
    }
    catch (e) {
        // Swallow any exceptions encountered in executing command
        // such as --format flag not supported in old docker cli versions
        output = null;
        defer.resolve();
        tl.warning("Not publishing to image meta data store as get history failed with error " + e);
    }

    await defer.promise;
    return output;
}

export async function getImageRootfsLayers(connection: ContainerConnection, imageDigest: string): Promise<string[]> {
    var command = connection.createCommand();
    command.arg("inspect");
    command.arg(imageDigest);
    command.arg(["-f", "{{.RootFS.Layers}}"]);

    const defer = Q.defer();
    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    try {
        connection.execCommand(command).then(() => {
            defer.resolve();
        });
    }
    catch (e) {
        // Swallow any exceptions encountered in executing command
        output = null;
        defer.resolve();
        tl.warning("get image inspect failed with error " + e);
    }

    await defer.promise;

    // Remove '[' and ']' from output
    output = output.replace(/\[/g, "");
    output = output.replace(/]/g, "");

    // Return array of rootLayers in the form -> [sha256:2c833f307fd8f18a378b71d3c43c575fabdb88955a2198662938ac2a08a99928,sha256:5f349fdc9028f7edde7f8d4c487d59b3e4b9d66a367dc85492fc7a81abf57b41, ...]
    let rootLayers = output.split(" ");
    return rootLayers;
}

export function getImageFingerPrint(rootLayers: string[], v1Name: string): { [key: string]: string | string[] } {
    let v2_blobs: string[] = [];
    let v2Name: string = "";
    if (rootLayers && rootLayers.length > 0) {
        rootLayers.forEach(layer => {
            // remove sha256 from layerIds
            const digest = getDigest(layer);
            v2_blobs.push(digest);

            // As per grafeas spec, the name of the image's v2 blobs computed via:
            //   [bottom] := v2_blob[bottom]
            //   [N] := sha256(v2_blob[N] + " " + v2_name[N+1])
            // Only the name of the final blob is kept.
            v2Name = v2Name + digest + " ";
        });

        v2Name = generateV2Name(v2Name.trim());
    }

    return {
        "v1Name": v1Name,
        "v2Blobs": v2_blobs,
        "v2Name": v2Name
    };
}

function getDigest(imageId: string): string {
    const imageMatch = imageId.match(matchPatternForDigest);
    if (imageMatch && imageMatch.length >= 1) {
        return imageMatch[1];
    }

    return "";
}

function generateV2Name(input: string): string {
    return crypto.createHash("sha256").update(input).digest("hex");
}

function isBuildKitBuild(): boolean {
    const isBuildKitBuildValue = tl.getVariable("DOCKER_BUILDKIT");
    return isBuildKitBuildValue && Number(isBuildKitBuildValue) == 1;
}