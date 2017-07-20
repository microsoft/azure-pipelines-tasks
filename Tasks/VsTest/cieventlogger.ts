import * as tl from 'vsts-task-lib/task';

const area: string = 'TestExecutionTask';
const feature: string = 'TaskExecution';

const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid'),
        collectionuri: tl.getVariable('System.TeamFoundationCollectionUri')
    };
}

export function publishEvent(properties: { [key: string]: any }): void {
    tl.publishTelemetry(area, feature, properties);
}