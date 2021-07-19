import * as tl from 'azure-pipelines-task-lib/task';
import * as semver from 'semver';

/**
 * Utility function to log telemetry.
 * @param feature The task/feature name for this telemetry
 * @param telem A JSON object containing a dictionary of variables that will be appended to
 * common system vars and loggged.
 */
export function emitTelemetry(area: string, feature: string, taskSpecificTelemetry: any) {
    try {
        let agentVersion = tl.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            // Common Telemetry VARs that will be concatenated with the supplied telem object.
            let commonTelem = {
                'SYSTEM_TASKINSTANCEID': tl.getVariable('SYSTEM_TASKINSTANCEID'),
                'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                'SYSTEM_PULLREQUEST_ISFORK': tl.getVariable('SYSTEM_PULLREQUEST_ISFORK'),
                'AGENT_ID': tl.getVariable('AGENT_ID'),
                'AGENT_MACHINENAME': tl.getVariable('AGENT_MACHINENAME'),
                'AGENT_NAME': tl.getVariable('AGENT_NAME'),
                'AGENT_JOBSTATUS': tl.getVariable('AGENT_JOBSTATUS'),
                'AGENT_OS': tl.getVariable('AGENT_OS'),
                'AGENT_OSARCHITECTURE': tl.getVariable('AGENT_OSARCHITECTURE'),
                'AGENT_VERSION': tl.getVariable('AGENT_VERSION'),
                'BUILD_BUILDID': tl.getVariable('BUILD_BUILDID'),
                'BUILD_BUILDNUMBER': tl.getVariable('BUILD_BUILDNUMBER'),
                'BUILD_BUILDURI': tl.getVariable('BUILD_BUILDURI'),
                'BUILD_CONTAINERID': tl.getVariable('BUILD_CONTAINERID'),
                'BUILD_DEFINITIONNAME': tl.getVariable('BUILD_DEFINITIONNAME'),
                'BUILD_DEFINITIONVERSION': tl.getVariable('BUILD_DEFINITIONVERSION'),
                'BUILD_REASON': tl.getVariable('BUILD_REASON')
            };
            let copy = Object.assign(commonTelem, taskSpecificTelemetry);
            console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
                area,
                feature,
                JSON.stringify(copy));
        } else {
            tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum requirements for telemetry`);
        }
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}