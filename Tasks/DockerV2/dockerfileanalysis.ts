'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs'
import { DockerfileParser, Keyword, Arg, Property } from 'dockerfile-ast'

const AllowedRegistries = [
    // Public
    '.azurecr.io',
    'mcr.microsoft.com',
    // Used by ACR team for testing
    '.azurecr-test.io',
    // Government Clouds
    '.azurecr.eaglex.ic.gov',
    '.azurecr.microsoft.scloud',
    '.azurecr.us',
    '.azurecr.cn',
];

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
export function dockerfileAnalysis(dockerfilePath: string, args: string): string[] {
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
    return dockerfileAnalysisCore(dockerfileContent, args);
}

export function dockerfileAnalysisCore(dockerfileContent: string, args: string): string[] {
    const buildArgs = parseBuildArgs(args);
    const [imageRefs, namedStages] = parseDockerfile(dockerfileContent, buildArgs);

    let invalidImageRefs = new Array<string>();
    for (let imageRef of imageRefs) {
        let validRegistry = false;
        const refParts = imageRef.split('/', 2);
        if (refParts.length === 1) {
            if (namedStages.includes(refParts[0])) {
                // case 1: FROM previous stages
                validRegistry = true;
            }
            // case 2: FROM image
            // assume it is from docker hub
        } else {
            // case 3: FROM registry/image
            // need to check whether the registry is allowed
            const registry = refParts[0];
            for (const allowedRegistry of AllowedRegistries) {
                if (registry.endsWith(allowedRegistry)) {
                    validRegistry = true;
                    break;
                }
            }
        }

        if (!validRegistry) {
            invalidImageRefs.push(imageRef);
        }
    }

    if (invalidImageRefs.length > 0) {
        tl.setVariable('DOCKERFILE_INVALID_IMAGE_REFS', invalidImageRefs.join(','), false, true);
        tl.setResult(tl.TaskResult.SucceededWithIssues, `Invalid image references: ${invalidImageRefs.join(', ')}`);
    }
    return invalidImageRefs;
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
function parseDockerfile(content: string, buildArgs: Map<string, string>): [string[], string[]] {
    const dockerfile = DockerfileParser.parse(content);
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

    let imageRefs = new Array<string>();
    let stages = new Array<string>();
    // parse FROM instructions
    const froms = dockerfile.getFROMs();
    for (const from of froms) {
        imageRefs.push(fillPlaceholders(from.getImage(), argsMap));

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
            imageRefs.push(copyFrom.getValue());
        }
    } 

    return [imageRefs, stages];
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
    if (!s){
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
