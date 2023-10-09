import tl = require('azure-pipelines-task-lib/task');
import * as semver from 'semver';

export interface TelemetryPayload {
    msBuildVersion: string;
    msBuildLocationMethod: string;
    platform: string;
    configuration: string;
    msbuildExectionTimeSeconds: number;
}

export function emitTelemetry(telemetryData: TelemetryPayload) {
    try {
        let agentVersion = tl.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            let telemetry = JSON.stringify(telemetryData);

            console.log(`##vso[telemetry.publish area=TaskHub;feature=MSBuildV1]${telemetry}`);
        } else {
            tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum requirements for telemetry`);
        }
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}
