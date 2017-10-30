import * as tl from 'vsts-task-lib/task';
import semver = require('semver');

const area: string = 'TestExecution';
const feature: string = 'TestExecutionTask';

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid')
    };
}

export function publishEvent(properties: { [key: string]: any }): void {
    try {
        const agentVersion: string = tl.getVariable('Agent.Version');
        if (agentVersion && !semver.lt(agentVersion, '2.125.0')) {
            tl.publishTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
        } else {
            tl.debug('Unable to publish telemetry due to lower agent version: ' + agentVersion);
        }
    } catch (err) {
        //ignore
    }
}