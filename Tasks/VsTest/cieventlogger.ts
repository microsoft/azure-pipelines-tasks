import * as tl from 'vsts-task-lib/task';
const ver = require('semver');

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
        const agent = tl.getVariable('Agent.Version');
        if (!agent || ver.lt(agent, '2.120.0')) {
            return;
        }

        const data = JSON.stringify(Object.assign(getDefaultProps(), properties));
        tl.command('telemetry.publish', { 'area': area, 'feature': feature }, data);
    } catch (err) {
        //ignore
    }
}