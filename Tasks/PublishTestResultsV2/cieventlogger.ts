import * as tl from 'azure-pipelines-task-lib/task';
import * as crypto from 'crypto';

const area: string = 'TestExecution';
const feature: string = 'PublishTestResultsTask';
const consolidatedCiData: { [key: string]: any; } = <{ [key: string]: any; }>{};
const invocationId: string = crypto.randomBytes(16).toString('hex');
const startTime = process.hrtime();
let sequence: number = 0;

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid'),
        osType: tl.osType(),
        planId: tl.getVariable('System.PlanId'),
        jobId: tl.getVariable('System.JobId'),
        jobAttempt: tl.getVariable('System.JobAttempt'),
        taskInstanceId: tl.getVariable('System.TaskInstanceId'),
        agentVersion: tl.getVariable('Agent.Version'),
        invocationId,
        processId: process.pid,
        nodeVersion: process.version,
        nodeArchitecture: process.arch
    };
}

export function addToConsolidatedCi(key: string, value: any) {
    consolidatedCiData[key] = value;
}

export function publishStage(stage: string, properties: { [key: string]: any } = {}): void {
    const elapsed = process.hrtime(startTime);
    const elapsedTimeMs = Math.round(elapsed[0] * 1000 + elapsed[1] / 1000000);
    const previousStage = consolidatedCiData.lastStage;
    consolidatedCiData.previousStage = previousStage;
    consolidatedCiData.lastStage = stage;
    consolidatedCiData.elapsedTimeMs = elapsedTimeMs;
    publishEvent('publishTestResultsTaskStageEvent', Object.assign({}, properties, {
        stage,
        previousStage,
        sequence: ++sequence,
        elapsedTimeMs
    }));
}

export function fireConsolidatedCi() {
    publishEvent('publishTestResultsTaskConsolidatedCiEvent', consolidatedCiData);
}

export function publishEvent(subFeature: string, properties: { [key: string]: any }): void {
    try {
        properties.subFeature = subFeature;
        _writeTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
    } catch (err) {
        tl.debug('Unable to publish telemetry due to lower agent version.');
    }
}


function _writeTelemetry(area, feature, properties) {
    // The telemetry command was added in agent version 2.120.0.
    try {
        var splitVersion = (process.env.AGENT_VERSION || '').split('.');
        var major = parseInt(splitVersion[0] || '0');
        var minor = parseInt(splitVersion[1] || '0');
        if (major > 2 || (major == 2 && minor >= 120)) {
            console.log(`##vso[telemetry.publish area=${area};feature=${feature}]${JSON.stringify(properties)}`);
        }
        else {
            tl.debug(`cannot write telemetry in agent ${process.env.AGENT_VERSION}`);
        }
    }
    catch (err) {
        tl.debug(`Error in writing telemetry : ${err}`);
    }
}
