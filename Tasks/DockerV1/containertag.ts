"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as utils from "./utils";
import * as Q from 'q';
import { createSanitizedExecOptions, sanitizeDockerOutput } from "azure-pipelines-tasks-docker-common/dockercommandutils";

const useDockerSkipRedundantTagFeature = "UseDockerSkipRedundantTag";
const sanitizeDockerTagLogOutputFeature = "DockerTagSanitizeLogOutput";

// Independent of the sanitizer's own pattern on purpose: it verifies the result, so a sanitizer bug cannot
// hide itself. Any "##vso[" left anywhere in the text counts as a failed fix.
const vsoMarkerPattern = /##vso\[/i;
const withheldImagePlaceholder = "[image name withheld: contains an unsafe logging-command marker]";

type SanitizeOutcome = 'Clean' | 'Sanitized' | 'SanitizeFailed';

interface SafeLogImage {
    text: string;
    outcome: SanitizeOutcome;
    markerDetected: boolean;
    reason?: 'ResidualMarker' | 'SanitizerThrew';
}

// Only called when the DockerTagSanitizeLogOutput feature is on. Fails closed: if sanitizing throws or a
// marker survives, the name is withheld from the log.
function getSafeLogImage(sourceImage: string): SafeLogImage {
    const markerInInput = vsoMarkerPattern.test(sourceImage);
    try {
        const sanitized = sanitizeDockerOutput(sourceImage);
        const markerDetected = markerInInput || sanitized !== sourceImage;
        if (vsoMarkerPattern.test(sanitized)) {
            return { text: withheldImagePlaceholder, outcome: 'SanitizeFailed', markerDetected, reason: 'ResidualMarker' };
        }
        return { text: sanitized, outcome: markerDetected ? 'Sanitized' : 'Clean', markerDetected };
    } catch (err) {
        tl.debug(`Unable to sanitize image name for logging: ${err && err.message ? err.message : err}`);
        return { text: withheldImagePlaceholder, outcome: 'SanitizeFailed', markerDetected: markerInInput, reason: 'SanitizerThrew' };
    }
}

// Only called when the feature is on. Telemetry never carries the image name. Outcome=SanitizeFailed is the
// signal to alert on: the fix did not neutralize the marker. It must never fail the task.
function emitSanitizeTelemetry(result: SafeLogImage): void {
    try {
        const payload = {
            command: "tag",
            outcome: result.outcome,
            reason: result.reason,
            markerDetected: result.markerDetected,
            jobId: tl.getVariable('SYSTEM_JOBID'),
            agentOS: process.env.AGENT_OS,
            agentVersion: process.env.AGENT_VERSION
        };
        console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
            "TaskHub",
            sanitizeDockerTagLogOutputFeature,
            JSON.stringify(payload));
    } catch (err) {
        tl.debug(`Unable to publish ${sanitizeDockerTagLogOutputFeature} telemetry: ${err && err.message ? err.message : err}`);
    }
}

function dockerTag(connection: ContainerConnection, sourceImage: string, targetImage: string, qualifyImageName: boolean, qualifySourceImageName: boolean, shouldSkipRedundantTag: boolean, shouldSanitizeLogOutput: boolean): Q.Promise<void> {
    let command = connection.createCommand();
    command.arg("tag");
    if (qualifyImageName) {
        targetImage = connection.getQualifiedImageNameIfRequired(targetImage);
    }
    if (qualifySourceImageName) {
        sourceImage = connection.getQualifiedImageNameIfRequired(sourceImage);
    }

    // Skip only when the feature flag is enabled and source/target are identical.
    if (shouldSkipRedundantTag && sourceImage === targetImage) {
        if (!shouldSanitizeLogOutput) {
            // Feature off: exactly the original behavior.
            console.log(`Skipping tag because ${useDockerSkipRedundantTagFeature} is enabled and source/target are identical: ${sourceImage}`);
            return Q.resolve();
        }

        const safeImage = getSafeLogImage(sourceImage);
        console.log(`Skipping tag because ${useDockerSkipRedundantTagFeature} is enabled and source/target are identical: ${safeImage.text}`);
        emitSanitizeTelemetry(safeImage);
        return Q.resolve();
    }

    command.arg(sourceImage);
    command.arg(targetImage);

    tl.debug(`Tagging image ${sourceImage} with ${targetImage}.`);
    return connection.execCommand(command, createSanitizedExecOptions());
}

export function run(connection: ContainerConnection): Q.Promise<void> {
    let imageNames;
    let useMultiImageMode = tl.getBoolInput("tagMultipleImages");
    if (useMultiImageMode) {
        imageNames = utils.getImageNames();
    } else {
        imageNames = [utils.getImageName()];
    }
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    const qualifySourceImageName = tl.getBoolInput("qualifySourceImageName");
    const shouldSkipRedundantTag = tl.getPipelineFeature(useDockerSkipRedundantTagFeature);
    const shouldSanitizeLogOutput = tl.getPipelineFeature(sanitizeDockerTagLogOutputFeature);
    let additionalImageTags = tl.getDelimitedInput("arguments", "\n");
    let imageMappings = utils.getImageMappings(connection, imageNames, additionalImageTags);

    let firstMapping = imageMappings.shift();
    let promise = dockerTag(connection, firstMapping.sourceImageName, firstMapping.targetImageName, qualifyImageName,     qualifySourceImageName, shouldSkipRedundantTag, shouldSanitizeLogOutput);
    imageMappings.forEach(mapping => {
            promise = promise.then(() => dockerTag(connection, mapping.sourceImageName, mapping.targetImageName, qualifyImageName, qualifySourceImageName, shouldSkipRedundantTag, shouldSanitizeLogOutput));
    });

    return promise;
}