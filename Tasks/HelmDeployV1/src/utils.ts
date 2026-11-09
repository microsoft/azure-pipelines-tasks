"use strict";

var fs = require('fs');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as os from "os";
import * as yaml from 'js-yaml';
import * as semver from 'semver';

import helmcli from "./helmcli";

const matchPatternForReleaseName = new RegExp(/NAME:(.+)/i);
const namespace = trimIdentifierInput(tl.getInput('namespace', false));

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getTaskTempDir(): string {
    var userDir = path.join(getTempDirectory(), "helmTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
}
export function deleteFile(filepath: string): void {
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
}

export function resolvePath(path: string): string {
    if (path.indexOf('*') >= 0 || path.indexOf('?') >= 0) {
        tl.debug(tl.loc('PatternFoundInPath', path));
        var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');
        var allPaths = tl.find(rootFolder);
        var matchingResultsFiles = tl.match(allPaths, path, rootFolder, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('CantResolvePatternInPath', path));
        }

        return matchingResultsFiles[0];
    }
    else {
        tl.debug(tl.loc('PatternNotFoundInFilePath', path));
        return path;
    }
}

/**
 * Trims leading/trailing whitespace from a plain identifier-style value
 * (a release name, namespace, chart name, or registry name) before it is
 * added as a single Helm argument via addSingleArgument().
 */
export function trimIdentifierInput(value: string): string {
    return value ? value.trim() : value;
}

export function validateReleaseName(value: string): string {
    if (!value || value.startsWith("-")) {
        throw new Error(tl.loc("InvalidReleaseName", value));
    }
    return value;
}

// Chart references and repository URLs are positional Helm arguments, so a leading '-' would be parsed as an option.
export function validateChartReference(value: string): string {
    if (!tl.getPipelineFeature('HelmDeploy.DisableStrictSetArguments') && value && value.startsWith('-')) {
        throw new Error(tl.loc('InvalidChartReference', value));
    }
    return value;
}

export function extractReleaseNameFromHelmOutput(output: string) {
    const releaseNameMatch = output.match(matchPatternForReleaseName);
    if (releaseNameMatch && releaseNameMatch.length >= 1)
        return releaseNameMatch[1].trim();
    return '';
}

export function getManifestsFromRelease(helmCli: helmcli, releaseName: string): any {
    let manifests = [];
    if (releaseName.length == 0)
        return manifests;

    helmCli.resetArguments();
    helmCli.setCommand('get');
    helmCli.addArgument('manifest');
    helmCli.addSingleArgument(releaseName);
    if (namespace) {
        helmCli.addSingleArgument('--namespace');
        helmCli.addSingleArgument(namespace);
    }

    const execResult = helmCli.execHelmCommand(true);

    yaml.safeLoadAll(execResult.stdout, (doc) => {
        if (doc === null) return;
        manifests.push(doc);
    });

    return manifests;
}

function ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export function getHelmPathForACR() {
    const chartName = trimIdentifierInput(tl.getInput("chartNameForACR", true));
    const acr = trimIdentifierInput(tl.getInput("azureContainerRegistry"));
    return acr + "/helm/" + chartName;
}

export function addVersion(helmCli: helmcli, version: string) {
    if (semver.valid(version)) {
        helmCli.addSingleArgument("--version");
        helmCli.addSingleArgument(version);
    } else {
        console.log("The given version is not valid. Running the helm install command with latest version");
    }
}

export function replaceNewlinesWithCommas(overrideValues: string): string {
    const keyValuePairs = overrideValues.split("\n").filter(pair => pair);
    return keyValuePairs.join(",");
}

// Builds the --set arguments as discrete argv entries so the value is never re-tokenized on whitespace. Enabling the HelmDeploy.DisableStrictSetArguments pipeline feature restores the legacy behavior.
export function addOverrideValuesArguments(helmCli: any, overrideValues: string): void {
    if (!tl.getPipelineFeature('HelmDeploy.DisableStrictSetArguments')) {
        const value = overrideValues.split(/\r?\n/).filter(pair => pair.trim()).join(',').replace(/\\"|"/g, m => m === '"' ? '' : '"').trim();
        if (value) {
            if (value.indexOf(' --') !== -1) {
                tl.warning(tl.loc('OverrideValuesContainOptionLikeText'));
            }
            helmCli.addSingleArgument('--set');
            helmCli.addSingleArgument(value);
        }
    } else {
        helmCli.addArgument('--set '.concat(replaceNewlinesWithCommas(overrideValues)));
    }
}
