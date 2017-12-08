/**
 * WARNING: This module should only be used with the express permission of the repo owners.
 */
import * as tl from 'vsts-task-lib/task';
import * as semver from 'semver';

/**
 * Utility function to log telemetry.
 * @param telem A JSON object containing a dictionary of variables that will be appended to
 * common system vars and loggged.
 */
export function emitTelemetry(taskSpecificTelemetry: any) {
    try {
        let agentVersion = tl.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            // Common Telemetry VARs that will be concatenated with the supplied telem object.
            let commonTelem = {
                'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                'AGENT_BUILDDIRECTORY': tl.getVariable('AGENT_BUILDDIRECTORY'),
                'AGENT_HOMEDIRECTORY': tl.getVariable('AGENT_HOMEDIRECTORY'),
                'AGENT_WORKFOLDER': tl.getVariable('AGENT_WORKFOLDER'),
                'AGENT_ROOTDIRECTORY': tl.getVariable('AGENT_ROOTDIRECTORY'),
                'AGENT_TOOLSDIRECTORY': tl.getVariable('AGENT_TOOLSDIRECTORY'),
                'AGENT_SERVEROMDIRECTORY': tl.getVariable('AGENT_SERVEROMDIRECTORY'),
                'AGENT_TEMPDIRECTORY': tl.getVariable('AGENT_TEMPDIRECTORY'),
                'AGENT_ID': tl.getVariable('AGENT_ID'),
                'AGENT_MACHINENAME': tl.getVariable('AGENT_MACHINENAME'),
                'AGENT_NAME': tl.getVariable('AGENT_NAME'),
                'AGENT_JOBSTATUS': tl.getVariable('AGENT_JOBSTATUS'),
                'AGENT_OS': tl.getVariable('AGENT_OS'),
                'AGENT_VERSION': tl.getVariable('AGENT_VERSION'),
                'BUILD_ARTIFACTSTAGINGDIRECTORY': tl.getVariable('BUILD_ARTIFACTSTAGINGDIRECTORY'),
                'BUILD_BINARIESDIRECTORY': tl.getVariable('BUILD_BINARIESDIRECTORY'),
                'BUILD_BUILDID': tl.getVariable('BUILD_BUILDID'),
                'BUILD_BUILDNUMBER': tl.getVariable('BUILD_BUILDNUMBER'),
                'BUILD_BUILDURI': tl.getVariable('BUILD_BUILDURI'),
                'BUILD_CONTAINERID': tl.getVariable('BUILD_CONTAINERID'),
                'BUILD_DEFINITIONNAME': tl.getVariable('BUILD_DEFINITIONNAME'),
                'BUILD_DEFINITIONVERSION': tl.getVariable('BUILD_DEFINITIONVERSION'),
                'BUILD_REASON': tl.getVariable('BUILD_REASON'),
                'BUILD_REPOSITORY_CLEAN': tl.getVariable('BUILD_REPOSITORY_CLEAN'),
                'BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT': tl.getVariable('BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT'),
                'BUILD_REPOSITORY_ID': tl.getVariable('BUILD_REPOSITORY_ID'),
                'BUILD_REPOSITORY_LOCALPATH': tl.getVariable('BUILD_REPOSITORY_LOCALPATH'),
                'BUILD_REPOSITORY_NAME': tl.getVariable('BUILD_REPOSITORY_NAME'),
                'BUILD_REPOSITORY_PROVIDER': tl.getVariable('BUILD_REPOSITORY_PROVIDER'),
                'BUILD_REPOSITORY_URI': tl.getVariable('BUILD_REPOSITORY_URI'),
                'BUILD_SOURCEBRANCH': tl.getVariable('BUILD_SOURCEBRANCH'),
                'BUILD_SOURCEBRANCHNAME': tl.getVariable('BUILD_SOURCEBRANCHNAME'),
                'BUILD_SOURCESDIRECTORY': tl.getVariable('BUILD_SOURCESDIRECTORY'),
                'BUILD_SOURCEVERSION': tl.getVariable('BUILD_SOURCEVERSION'),
                'BUILD_STAGINGDIRECTORY': tl.getVariable('BUILD_STAGINGDIRECTORY'),
                'agent.proxyurl': tl.getVariable("agent.proxyurl")
            };
            let copy = Object.assign(commonTelem, taskSpecificTelemetry);
            console.log("##vso[telemetry.publish area=Packaging;feature=NuGetCommand]%s",
                JSON.stringify(copy));
        } else {
            tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum reqiurements for telemetry`);
        }
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}

/**
 * A utility function to log the first 1024 characters from SDTERR
 * @param exitCode The exit code from your program
 * @param stderr STDERR from your program
 */
export function logStderr(exitCode: number, stderr: string) {
    try {
        let nugetExecResultsStr = JSON.stringify({
            'exitCode': exitCode,
            'stderr': (stderr) ? stderr.substr(0, 1024) : null
        });
        let nugetExecResults = JSON.parse(nugetExecResultsStr);
        emitTelemetry(nugetExecResults);
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}