import * as taskLib from 'vsts-task-lib/task';
// Remove once task lib 2.0.4 releases
global['_vsts_task_lib_loaded'] = true;
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as restm from 'typed-rest-client/RestClient';
import * as path from "path";
import semver = require('semver');

import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

async function run() {
    try {
        taskLib.setResourcePath(path.join(__dirname, "task.json"));
        logNugetToolInstallerStartupVariables();
        let versionSpec = taskLib.getInput('versionSpec', true);
        let checkLatest = taskLib.getBoolInput('checkLatest', false);
        await nuGetGetter.getNuGet(versionSpec, checkLatest, true);
    }
    catch (error) {
        console.error('ERR:' + error.message);
        taskLib.setResult(taskLib.TaskResult.Failed, "");
    }
}

function logNugetToolInstallerStartupVariables() {
    try {
        let agentVersion = taskLib.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            console.log("##vso[telemetry.publish area=Packaging;feature=NuGetToolInstaller]%s",
                JSON.stringify({
                    'SYSTEM_JOBID': taskLib.getVariable('SYSTEM_JOBID'),
                    'SYSTEM_PLANID': taskLib.getVariable('SYSTEM_PLANID'),
                    'SYSTEM_COLLECTIONID': taskLib.getVariable('SYSTEM_COLLECTIONID'),
                    'versionSpec': taskLib.getInput('versionSpec'),
                    'checkLatest': taskLib.getInput("checkLatest"),
                    'AGENT_BUILDDIRECTORY': taskLib.getVariable('AGENT_BUILDDIRECTORY'),
                    'AGENT_HOMEDIRECTORY': taskLib.getVariable('AGENT_HOMEDIRECTORY'),
                    'AGENT_WORKFOLDER': taskLib.getVariable('AGENT_WORKFOLDER'),
                    'AGENT_ROOTDIRECTORY': taskLib.getVariable('AGENT_ROOTDIRECTORY'),
                    'AGENT_TOOLSDIRECTORY': taskLib.getVariable('AGENT_TOOLSDIRECTORY'),
                    'AGENT_SERVEROMDIRECTORY': taskLib.getVariable('AGENT_SERVEROMDIRECTORY'),
                    'AGENT_TEMPDIRECTORY': taskLib.getVariable('AGENT_TEMPDIRECTORY'),
                    'AGENT_ID': taskLib.getVariable('AGENT_ID'),
                    'AGENT_MACHINENAME': taskLib.getVariable('AGENT_MACHINENAME'),
                    'AGENT_NAME': taskLib.getVariable('AGENT_NAME'),
                    'AGENT_JOBSTATUS': taskLib.getVariable('AGENT_JOBSTATUS'),
                    'AGENT_OS': taskLib.getVariable('AGENT_OS'),
                    'AGENT_VERSION': taskLib.getVariable('AGENT_VERSION'),
                    'BUILD_ARTIFACTSTAGINGDIRECTORY': taskLib.getVariable('BUILD_ARTIFACTSTAGINGDIRECTORY'),
                    'BUILD_BINARIESDIRECTORY': taskLib.getVariable('BUILD_BINARIESDIRECTORY'),
                    'BUILD_BUILDID': taskLib.getVariable('BUILD_BUILDID'),
                    'BUILD_BUILDNUMBER': taskLib.getVariable('BUILD_BUILDNUMBER'),
                    'BUILD_BUILDURI': taskLib.getVariable('BUILD_BUILDURI'),
                    'BUILD_CONTAINERID': taskLib.getVariable('BUILD_CONTAINERID'),
                    'BUILD_DEFINITIONNAME': taskLib.getVariable('BUILD_DEFINITIONNAME'),
                    'BUILD_DEFINITIONVERSION': taskLib.getVariable('BUILD_DEFINITIONVERSION'),
                    'BUILD_REASON': taskLib.getVariable('BUILD_REASON'),
                    'BUILD_REPOSITORY_CLEAN': taskLib.getVariable('BUILD_REPOSITORY_CLEAN'),
                    'BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT': taskLib.getVariable('BUILD_REPOSITORY_GIT_SUBMODULECHECKOUT'),
                    'BUILD_REPOSITORY_ID': taskLib.getVariable('BUILD_REPOSITORY_ID'),
                    'BUILD_REPOSITORY_LOCALPATH': taskLib.getVariable('BUILD_REPOSITORY_LOCALPATH'),
                    'BUILD_REPOSITORY_NAME': taskLib.getVariable('BUILD_REPOSITORY_NAME'),
                    'BUILD_REPOSITORY_PROVIDER': taskLib.getVariable('BUILD_REPOSITORY_PROVIDER'),
                    'BUILD_REPOSITORY_URI': taskLib.getVariable('BUILD_REPOSITORY_URI'),
                    'BUILD_SOURCEBRANCH': taskLib.getVariable('BUILD_SOURCEBRANCH'),
                    'BUILD_SOURCEBRANCHNAME': taskLib.getVariable('BUILD_SOURCEBRANCHNAME'),
                    'BUILD_SOURCESDIRECTORY': taskLib.getVariable('BUILD_SOURCESDIRECTORY'),
                    'BUILD_SOURCEVERSION': taskLib.getVariable('BUILD_SOURCEVERSION'),
                    'BUILD_STAGINGDIRECTORY': taskLib.getVariable('BUILD_STAGINGDIRECTORY'),
                    'agent.proxyurl': taskLib.getVariable("agent.proxyurl")
                }));
        } else {
            taskLib.debug(`Agent version of ( ${agentVersion} ) does not meet minimum reqiurements for telemetry`);
        }
    } catch (err) {
        taskLib.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}

run();
