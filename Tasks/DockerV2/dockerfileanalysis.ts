'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import { Dockerfile, DockerfileParser, Keyword } from 'dockerfile-ast';
import * as fs from 'fs';

export const enableDockerfileAnalysis = 'ENABLE_DOCKERFILE_ANALISYS';
export const disableDockerDetector = 'DisableDockerDetector';
const dockerfileAnalysisReport = 'DOCKERFILE_ANALYSIS_REPORT';
const dockerfileAllowedRegistries = "DOCKERFILE_ALLOWED_REGISTRIES"

/**
 * Analyzes a Dockerfile content to identify untrusted image references.
 * 
 * This function extracts build arguments and parses the Dockerfile to identify 
 * image references. It then checks each image reference for validity. 
 * Valid image references are:
 * 1. References to previous build stages.
 * 2. Direct references to images, assumed to be from Docker Hub.
 * 3. References from allowed registries (defined in `AllowedRegistries`).
 * 
 * Example:
 * Dockerfile Content:
 * ```
 * ARG BASE_IMAGE
 * FROM $BASE_IMAGE:latest
 * ```
 * args: "--build-arg BASE_IMAGE=ubuntu"
 * Output: ["ubuntu:latest"]
 * 
 * @param dockerfileContent - The content of the Dockerfile as a string.
 * @param args - The build arguments as a string in the format "--build-arg KEY=VALUE".
 * @returns An array of invalid image references found in the Dockerfile.
 * @throws Error if there's an invalid instruction format, a missing build argument,
 *               or other parsing errors.
 */
export function dockerfileAnalysis(dockerfilePath: string, args: string) {
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
    const unallowedImagesInfo = dockerfileAnalysisCore(dockerfileContent, args);
    if (unallowedImagesInfo.length > 0) {
        // get the report from DOCKERFILE_ANALYSIS_REPORT variable. 
        // The report variable may be set by previous tasks.
        //
        // JSON format:
        // {
        //   "<dockerfilePath>": [ 
        //       {
        //           "imageRef": "<imageRef>",
        //           "line": <line>
        //       }
        //   ]
        // }
        let existReport = tl.getVariable(dockerfileAnalysisReport);
        let report = existReport ? JSON.parse(existReport) : {};
        if (!report[dockerfilePath]) {
            report[dockerfilePath] = [];
        }

        for (const [imageRef, line] of unallowedImagesInfo) {
            // write to report
            report[dockerfilePath].push({
                'imageRef': imageRef,
                'line': line
            })
            // log warning
            tl.warning(`Discovered a reference to an image from an unapproved registry that violates the security policies and standards for containers within Microsoft. Reference to image ${imageRef} on line ${line} of ${dockerfilePath}. For more details, visit https://aka.ms/cssc/3pimages`)
        }

        // update report variable
        tl.setVariable(dockerfileAnalysisReport, JSON.stringify(report), false, true);
        tl.setResult(tl.TaskResult.SucceededWithIssues, `Unapproved registry found in Dockerfile: ${dockerfilePath}`);
    }
}

export function dockerfileAnalysisCore(dockerfileContent: string, args: string): [string, number][] {
   const allowedRegistriesStr = tl.getVariable(dockerfileAllowedRegistries)
    if (!allowedRegistriesStr) {
        tl.debug('Skip dockerfile analysis because DOCKERFILE_ALLOWED_REGISTRIES is not set')
        return [];
    }
    const allowedRegistries = allowedRegistriesStr.split(',').map((s) => s.trim());
    const allowDockerHub = allowedRegistries.includes('docker.io');
    const buildArgs = parseBuildArgs(args);
    const [imagesInfo, stages] = parseDockerfile(dockerfileContent, buildArgs);

    let unallowedImagesInfo = new Array<[string, number]>();
    for (const [imageRef, line] of imagesInfo) {
        let isAllowedRegistry = false;
        const refParts = imageRef.split('/', 2);
        if (refParts.length === 1) {
            // FROM image
            if (stages.includes(refParts[0]) || allowDockerHub) {
                // case 1: image from previous stages or from docker hub
                isAllowedRegistry = true;
            }
            // case 2: docker.io is not allowed
        } else {
            // case 3: FROM registry/image
            // need to check whether the registry is allowed
            const registry = refParts[0];
            for (const allowedRegistry of allowedRegistries) {
                if (registry.endsWith(allowedRegistry)) {
                    isAllowedRegistry = true;
                    break;
                }
            }
        }

        if (!isAllowedRegistry) {
            unallowedImagesInfo.push([imageRef, line]);
        }
    }

    return unallowedImagesInfo;
}

/**
 * Parses build arguments from a given string and extracts key=value pairs.
 * 
 * The function expects the input string to have arguments in the format:
 * "--build-arg key=value" or "--build-arg=key=value".
 * Multiple build arguments can be provided in the input string.
 * 
 * Example:
 * Input: "--build-arg key1=value1 --build-arg key2=value2"
 * Output: Map { "key1" => "value1", "key2" => "value2" }
 * 
 * @param args - The input string containing build arguments.
 * @returns A map containing key-value pairs extracted from the input string.
 * @throws Error if the input string has invalid build arguments format or if the key name is invalid.
 */
function parseBuildArgs(args: string): Map<string, string> {
    const BUILD_ARG = '--build-arg';

    let buildArgs = new Map<string, string>();
    let currentIndex = 0;

    while ((currentIndex = args.indexOf(BUILD_ARG, currentIndex)) != -1) {
        const { key, value, endIndex } = parseBuildArg(args, currentIndex + BUILD_ARG.length + 1);

        validateKeyName(key);
        buildArgs.set(key, value);

        currentIndex = endIndex;
    }

    return buildArgs;
}

function parseBuildArg(args: string, startIndex: number): { key: string; value: string; endIndex: number } {
    if (args[startIndex] === '=') {
        // skip `=`: --build-arg=key=value
        startIndex++;
    } else {
        // skip ` `: --build-arg    key=value
        while (startIndex < args.length && args[startIndex] === ' ') {
            startIndex++;
        }
    }

    const equalPosition = args.indexOf('=', startIndex);
    if (equalPosition < 0) {
        throw new Error('Invalid build arguments');
    }

    const key = args.substring(startIndex, equalPosition);

    const spacePosition = args.indexOf(' ', equalPosition);
    const valueEnd = spacePosition === -1 ? args.length : spacePosition;
    const value = args.substring(equalPosition + 1, valueEnd);

    return { key, value, endIndex: valueEnd };
}

/**
 * Parses a Dockerfile content to extract image references and named stages.
 * 
 * This function extracts the values from the ARG, FROM, and COPY instructions.
 * 
 * The function handles ARG placeholders in the Dockerfile and replaces them
 * with the provided `buildArgs` values. The value of the arguments of ARG 
 * instructions will be replaced with the provided `buildArgs` values.
 *  
 * Note: This function relies on an external Dockerfile parser for initial parsing.
 * 
 * Example:
 * Dockerfile Content:
 * ```
 * ARG BASE_IMAGE=ubuntu:latest
 * FROM $BASE_IMAGE
 * ```
 * buildArgs: Map { "BASE_IMAGE" => "ubuntu:20.04" }
 * Output: (["ubuntu:20.04"], [])
 * 
 * @param content - The content of the Dockerfile as a string.
 * @param buildArgs - A map containing key-value pairs to replace ARG placeholders.
 * 
 * @returns A tuple where the first array contains extracted image references
 *          and the second array contains named stages from the Dockerfile.
 * 
 * @throws Error if there's an invalid instruction format or a missing build argument.
 */
function parseDockerfile(content: string, buildArgs: Map<string, string>): [[string, number][], string[]] {
    const dockerfile = DockerfileParser.parse(content);

    // check whether need to disable the detector
    const skipReason = getSkipReason(dockerfile);
    if (skipReason) {
        console.log(`Skip dockerfile analysis because ${skipReason}`);
        return [[], []];
    }

    const instructions = dockerfile.getInstructions();
    let argsMap = new Map<string, string>();
    // parse ARG instructions before FROM to prepare the arguments map
    // note: multi-stage FROM command cannot use ARG that is defined after the
    // first from, so we only need to parse ARG instructions before the first 
    // FROM
    for (let i = 0; i < instructions.length; i++) {
        const command = instructions[i].getInstruction();
        if (command.toUpperCase() !== Keyword.ARG) {
            // ARG is the only instruction that can be used before FROM
            break;
        }

        for (const arg of instructions[i].getArguments()) {
            let key, value: string
            const argStr = arg.getValue();
            const equalPosition = argStr.indexOf('=');
            if (equalPosition < 0) {
                // no default value: ARG IMAGE
                key = argStr;
            } else {
                // has default value: ARG IMAGE=ubuntu
                key = argStr.substring(0, equalPosition);
                value = argStr.substring(equalPosition + 1);
            }
            if (buildArgs.has(key)) {
                value = buildArgs.get(key);
            }
            argsMap.set(key, fillPlaceholders(value, argsMap));
        }
    }

    let imagesInfo = new Array<[string, number]>(); // [imageRef, line]
    let stages = new Array<string>(); // stage names
    // parse FROM instructions
    const froms = dockerfile.getFROMs();
    for (const from of froms) {
        const line = from.getRange().start.line;
        const imageRef = fillPlaceholders(from.getImage(), argsMap);
        imagesInfo.push([imageRef, line]);

        // save stage
        const stage = from.getBuildStage();
        if (stage) {
            stages.push(stage);
        }
    }

    // parse COPY instructions
    const copys = dockerfile.getCOPYs();
    for (const copy of copys) {
        const copyFrom = copy.getFromFlag();
        if (copyFrom) {
            const line = copyFrom.getRange().start.line;
            const imageRef = copyFrom.getValue();
            imagesInfo.push([imageRef, line]);
        }
    }

    return [imagesInfo, stages];
}

/**
 * Checks if the skip comment is somewhere in the Dockerfile
 * 
 * Example dockerfile:
 *   # DisableDockerDetector "My Reason Here"
 *   FROM docker.io/...
 * 
 * @param dockerfile the Dockerfile currently being scanned
 * @returns the skip reason if the skip comment is found, undefined otherwise 
 */
function getSkipReason(dockerfile: Dockerfile): string | undefined {
    return dockerfile
        .getComments()
        .find(
            (comment) =>
                // Matches # DisableDockerDetector "reason"
                comment.getContent().startsWith(disableDockerDetector) &&
                comment.getContent().match(/".*"/),
        )
        ?.getContent()
        .match(/"(.*)"/)?.[1];
}

/**
 * Replace placeholders in the string with their corresponding values from the provided map.
 * The placeholders can be in the format $key_1 or ${key_2}.
 * 
 * @param s - The input string containing placeholders.
 * @param argsMap - The map containing key-value pairs to replace placeholders.
 * @returns The string after replacing the placeholders.
 * @throws Error if the placeholder format is invalid or if a key is not found in the provided map.
 */
function fillPlaceholders(s: string, argsMap: Map<string, string>): string {
    if (!s) {
        return s;
    }

    let result = '';
    let currentIndex = 0;
    while (true) {
        let dollarPosition = s.indexOf('$', currentIndex);
        if (dollarPosition < 0) {
            result += s.substring(currentIndex);
            break;
        }

        result += s.substring(currentIndex, dollarPosition);
        if (dollarPosition + 1 >= s.length) {
            throw new Error('Invalid argument value');
        }
        let key = '';
        if (s[dollarPosition + 1] === '{') {
            // ${key}
            let curlyBraceEnd = s.indexOf('}', dollarPosition + 2);
            if (curlyBraceEnd < 0) {
                throw new Error('Invalid argument value');
            }
            key = s.substring(dollarPosition + 2, curlyBraceEnd);
            currentIndex = curlyBraceEnd + 1;
        } else {
            // $Key
            let keyNameEnd = dollarPosition + 1;
            // skip all letters and numbers and _
            while (keyNameEnd < s.length && s[keyNameEnd].match(/[a-zA-Z0-9_]/)) {
                keyNameEnd++;
            }
            key = s.substring(dollarPosition + 1, keyNameEnd);
            currentIndex = keyNameEnd;
        }
        // validate the key name
        validateKeyName(key);
        if (argsMap.has(key)) {
            result += argsMap.get(key);
        } else {
            throw new Error(`Unknown argument: ${key}`);
        }
    }

    return result;
}

function validateKeyName(key: string) {
    if (key.length === 0) {
        throw new Error('argument name is empty');
    }
    // only contains letters, numbers, and underscores, and starts with a letter
    if (!key.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
        throw new Error(`argument contains invalid character: "${key}"`);
    }
}
