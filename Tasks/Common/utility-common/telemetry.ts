/**
 * WARNING: This module should only be used with the express permission of the repo owners.
 */
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
                'AGENT_ID': tl.getVariable('AGENT_ID'),
                'AGENT_MACHINENAME': tl.getVariable('AGENT_MACHINENAME'),
                'AGENT_NAME': tl.getVariable('AGENT_NAME'),
                'AGENT_JOBSTATUS': tl.getVariable('AGENT_JOBSTATUS'),
                'AGENT_OS': tl.getVariable('AGENT_OS'),
                'AGENT_VERSION': tl.getVariable('AGENT_VERSION'),
                'BUILD_BUILDID': tl.getVariable('BUILD_BUILDID'),
                'BUILD_BUILDNUMBER': tl.getVariable('BUILD_BUILDNUMBER'),
                'BUILD_BUILDURI': tl.getVariable('BUILD_BUILDURI'),
                'BUILD_CONTAINERID': tl.getVariable('BUILD_CONTAINERID'),
                'BUILD_DEFINITIONNAME': tl.getVariable('BUILD_DEFINITIONNAME'),
                'BUILD_DEFINITIONVERSION': tl.getVariable('BUILD_DEFINITIONVERSION'),
                'BUILD_REASON': tl.getVariable('BUILD_REASON'),
                'BUILD_REPOSITORY_CLEAN': tl.getVariable('BUILD_REPOSITORY_CLEAN'),
                'BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT': tl.getVariable('BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT'),
                'BUILD_REPOSITORY_NAME': tl.getVariable('BUILD_REPOSITORY_NAME'),
                'BUILD_REPOSITORY_PROVIDER': tl.getVariable('BUILD_REPOSITORY_PROVIDER'),
                'BUILD_SOURCEVERSION': tl.getVariable('BUILD_SOURCEVERSION')
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

/**
 * A utility function to log the first 1024 characters from SDTERR
 * @param feature The task/feature name for this telemetry
 * @param exitCode The exit code from your program
 */
export function logResult(area: string, feature:string, exitCode: number) {
    try {
        let execResultsStr = JSON.stringify({
            'exitCode': exitCode
        });
        let nugetExecResults = JSON.parse(execResultsStr);
        emitTelemetry(area, feature, nugetExecResults);
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}