import * as path from 'path';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';
import * as Q from 'q';

import { NpmCommand, NpmTaskInput, RegistryLocation } from './constants';
import * as npmCustom from './npmcustom';
import * as npmPublish from './npmpublish';
import { GetRegistries, NormalizeRegistry } from 'npm-common/npmrcparser';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'npm-common/util';
import semver = require('semver');

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    logStartupVariables();

    const command = tl.getInput(NpmTaskInput.Command);
    switch (command) {
        case NpmCommand.Install:
            return npmCustom.run('install');
        case NpmCommand.Publish:
            return npmPublish.run();
        case NpmCommand.Custom:
            return npmCustom.run();
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc('UnknownCommand', command));
            return;
    }
}

function logStartupVariables() {
    try {
        let agentVersion = tl.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            let endpointId = tl.getInput(NpmTaskInput.PublishEndpoint);
            let endpointUrl = null;
            if (endpointId) {
                endpointUrl = tl.getEndpointUrl(endpointId, true);
            }
            let customEndpointIds = tl.getDelimitedInput(NpmTaskInput.CustomEndpoint, ',');
            let externalEndpointsUrls = null;
            if (customEndpointIds) {
                externalEndpointsUrls = customEndpointIds.reduce((ary, id) => {
                    let te = {
                        feedName: tl.getEndpointUrl(id, true).replace(/\W/g, ''),
                        feedUri: tl.getEndpointUrl(id, true)
                    }
                    ary.push(te);
                    return ary;
                }, []);
            }

            console.log("##vso[telemetry.publish area=Packaging;feature=Npm]%s",
                JSON.stringify({
                    'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                    'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                    'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                    'command': tl.getInput(NpmTaskInput.Command),
                    'arguments': tl.getInput(NpmTaskInput.CustomCommand),
                    'customregistry': tl.getInput(NpmTaskInput.CustomRegistry),
                    'customFeedId': tl.getInput(NpmTaskInput.CustomFeed),
                    'externalEndpointsUrls': externalEndpointsUrls,
                    'publishregistry': tl.getInput(NpmTaskInput.PublishRegistry),
                    'publishFeedId': tl.getInput(NpmTaskInput.PublishFeed),
                    'publishEndpointUrl': endpointUrl,
                    'verbose': tl.getInput(NpmTaskInput.Verbose),
                    'workingdir': tl.getInput(NpmTaskInput.WorkingDir),
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
                }));
        }else{
            tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum reqiurements for telemetry`);
        }
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}


main().catch(error => {
    tl.rmRF(util.getTempPath());
    tl.setResult(tl.TaskResult.Failed, error);
});
