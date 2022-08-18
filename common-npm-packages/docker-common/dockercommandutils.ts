"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as Q from "q";
import ContainerConnection from "./containerconnection";
import * as pipelineUtils from "./pipelineutils";

const matchPatternForSize = new RegExp(/[\d\.]+/);

export function build(connection: ContainerConnection, dockerFile: string, context: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any {
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

    command.arg(context);

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

export function getCommandArguments(args: string): string {
    return args ? args.replace(/\n/g, " ") : "";
}

export async function getLayers(connection: ContainerConnection, imageId: string): Promise<any> {
    var layers = [];
    var history = await getHistory(connection, imageId);
    if (!history) {
        return null;
    }
    
    var lines = history.split(/[\r?\n]/);

    lines.forEach(line => {
        line = line.trim();
        if (line.length != 0) {
            layers.push(parseHistory(line));
        }
    });

    return layers.reverse();
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

function parseHistory(input: string) {
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

async function getHistory(connection: ContainerConnection, image: string): Promise<string> {
    var command = connection.createCommand();
    command.arg("history");
    command.arg(["--format", "createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}"]);
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