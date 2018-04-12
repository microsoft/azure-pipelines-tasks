import * as tl from 'vsts-task-lib/task';

const area: string = 'TestExecution';
const feature: string = 'VsTestToolsInstaller';

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid')
    };
}

export function publishEvent(subFeature: string, properties: { [key: string]: any }): void {
    try {
        tl.assertAgent('2.125.0');
        properties['subFeature'] = subFeature;
        tl.publishTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
    } catch (err) {
        tl.debug(`Unable to publish telemetry due to lower agent version.`);
    }
}