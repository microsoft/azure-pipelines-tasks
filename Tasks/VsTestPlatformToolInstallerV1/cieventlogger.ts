import * as tl from 'azure-pipelines-task-lib/task';

const area: string = 'TestExecution';
const feature: string = 'VsTestToolsInstaller';
const consolidatedCiData: { [key: string]: any; } = <{ [key: string]: any; }>{};

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid')
    };
}

export function addToConsolidatedCi(key: string, value: any) {
    consolidatedCiData[key] = value;
}

export function fireConsolidatedCi() {
    publishEvent('vstestToolInstallerConsolidatedCiEvent', consolidatedCiData);
}

export function publishEvent(subFeature: string, properties: { [key: string]: any }): void {
    try {
        tl.assertAgent('2.125.0');
        properties.subFeature = subFeature;
        publishTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
    } catch (err) {
        tl.debug(`Unable to publish telemetry due to lower agent version.`);
    }
}

export function publishTelemetry(area: string, feature: string, properties: { [key: string]: any }): void {
    const data = JSON.stringify(properties);
    tl.debug('telemetry area: ' + area + ' feature: ' + feature + ' data: ' + data);
    tl.command('telemetry.publish', { 'area': area, 'feature': feature }, data);
}