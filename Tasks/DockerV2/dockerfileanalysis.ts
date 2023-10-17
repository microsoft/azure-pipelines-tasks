"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";

export function dockerfileAnalysis(dockerfilePath: string, args: string) {
    const buildArgs = parseBuildArgs(args);
}

// extract all key=value pairs from the args
function parseBuildArgs(args: string): Map<string, string> {
    const valueMap = new Map<string, string>();
    const BUILD_ARG_LENGTH = "--build-arg".length;

    let buildArgIndex = args.indexOf("--build-arg");
    while (buildArgIndex > 0) {
        let valueIndex = buildArgIndex + BUILD_ARG_LENGTH + 1;
        if (valueIndex >= args.length) {
            throw new Error("Invalid build arguments");
        }

        if (args[valueIndex] == '=') {
            // --build-arg=key=value
            valueIndex++;

        } else {
            // --build-arg    key=value
            while (valueIndex < args.length && args[valueIndex] == " ") {
                valueIndex++;
            }
        }

        // find the key
        const equalPosition = args.indexOf("=", valueIndex);
        if (equalPosition < 0) {
            throw new Error("Invalid build arguments");
        }
        const key = args.substring(valueIndex, equalPosition);

        // find the value
        const valueEndPosition = args.indexOf(" ", equalPosition + 1);
        if (valueEndPosition < 0) {
            throw new Error("Invalid build arguments");
        }
        const value = args.substring(equalPosition + 1, valueEndPosition);
        
        valueMap.set(key, value);

        buildArgIndex = args.indexOf("--build-arg", valueEndPosition);
    }

    return valueMap;
}

function parseDockerfile(){
    
}