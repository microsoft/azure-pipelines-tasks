import * as tl from "vsts-task-lib/task";
import * as path from "path";

import * as nugetRestore from './nugetrestore';
import * as nugetPublish from './nugetpublisher';
import * as nugetPack from './nugetpack';
import * as nugetCustom from './nugetcustom';
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");
import * as commandHelper from "nuget-task-common/CommandHelper";
import semver = require('semver');

const NUGET_EXE_CUSTOM_LOCATION: string = "NuGetExeCustomLocation";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    logNugetStartupVariables();

    // Getting NuGet
    tl.debug('Getting NuGet');
    let nuGetPath: string = undefined;
    try {
        nuGetPath = tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR) || tl.getVariable(NUGET_EXE_CUSTOM_LOCATION);
        if (!nuGetPath) {
            let cachedVersionToUse = nuGetGetter.DEFAULT_NUGET_VERSION;
            nuGetGetter.cacheBundledNuGet();
            if (tl.getVariable(nuGetGetter.FORCE_NUGET_4_0_0) &&
                tl.getVariable(nuGetGetter.FORCE_NUGET_4_0_0).toLowerCase() === "true") {
                cachedVersionToUse = nuGetGetter.NUGET_VERSION_4_0_0;
            }
            nuGetPath = await nuGetGetter.getNuGet(cachedVersionToUse);
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    }

    let nugetCommand = tl.getInput("command", true);
    switch (nugetCommand) {
        case "restore":
            nugetRestore.run(nuGetPath);
            break;
        case "pack":
            nugetPack.run(nuGetPath);
            break;
        case "push":
            nugetPublish.run(nuGetPath);
            break;
        case "custom":
            nugetCustom.run(nuGetPath);
            break;
        default:
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", nugetCommand));
            break;
    }
}

function logNugetStartupVariables() {
    try {
        let agentVersion = tl.getVariable('Agent.Version');
        if (semver.gte(agentVersion, '2.120.0')) {
            let externalendpoint = null;
            let epId = tl.getInput('externalendpoint');
            if (epId) {
                externalendpoint = {
                    feedName: tl.getEndpointUrl(epId, true).replace(/\W/g, ''),
                    feedUri: tl.getEndpointUrl(epId, true)
                }
            }
            let externalendpoints = tl.getDelimitedInput('externalendpoints', ',');
            if (externalendpoints) {
                externalendpoints = externalendpoints.reduce((ary, id) => {
                    let te = {
                        feedName: tl.getEndpointUrl(id, true).replace(/\W/g, ''),
                        feedUri: tl.getEndpointUrl(id, true)
                    }
                    ary.push(te);
                    return ary;
                }, []);
            }
            console.log("##vso[telemetry.publish area=Packaging;feature=NuGetCommand]%s",
                JSON.stringify({
                    'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                    'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                    'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                    'command': tl.getInput("command"),
                    'arguments': tl.getInput("arguments"),
                    'NUGET_EXE_TOOL_PATH_ENV_VAR': tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
                    'NUGET_EXE_CUSTOM_LOCATION': tl.getVariable(NUGET_EXE_CUSTOM_LOCATION),
                    'searchPatternPack': tl.getPathInput("searchPatternPack"),
                    'configurationToPack': tl.getInput("configurationToPack"),
                    'versioningScheme': tl.getInput("versioningScheme"),
                    'includeReferencedProjects': tl.getBoolInput("includeReferencedProjects"),
                    'versionEnvVar': tl.getInput("versionEnvVar") ?
                        tl.getInput(tl.getInput("versionEnvVar")) : null,
                    'requestedMajorVersion': tl.getInput("requestedMajorVersion"),
                    'requestedMinorVersion': tl.getInput("requestedMinorVersion"),
                    'requestedPatchVersion': tl.getInput("requestedPatchVersion"),
                    'packTimezone': tl.getInput("packTimezone"),
                    'buildProperties': tl.getInput("buildProperties"),
                    'verbosityPack': tl.getInput("verbosityPack"),
                    'includeSymbols': tl.getBoolInput("includeSymbols"),
                    'NuGet.UseLegacyFindFiles': tl.getVariable("NuGet.UseLegacyFindFiles"),
                    'NuGetTasks.IsHostedTestEnvironment': tl.getVariable("NuGetTasks.IsHostedTestEnvironment"),
                    'System.TeamFoundationCollectionUri': tl.getVariable("System.TeamFoundationCollectionUri"),
                    'NuGet.OverwritePackagingCollectionUrl': tl.getVariable("NuGet.OverwritePackagingCollectionUrl"),
                    'externalendpoint': externalendpoint,
                    'externalendpoints': externalendpoints,
                    'allowpackageconflicts': tl.getInput('allowpackageconflicts'),
                    'configurationtopack': tl.getInput('configurationtopack'),
                    'includenugetorg': tl.getInput('includenugetorg'),
                    'includereferencedprojects': tl.getInput('includereferencedprojects'),
                    'includesymbols': tl.getInput('includesymbols'),
                    'nocache': tl.getInput('nocache'),
                    'nugetconfigpath': tl.getInput('nugetconfigpath'),
                    'nugetfeedtype': tl.getInput('nugetfeedtype'),
                    'outputdir': tl.getInput('outputdir'),
                    'packtimezone': tl.getInput('packtimezone'),
                    'requestedmajorversion': tl.getInput('requestedmajorversion'),
                    'requestedminorversion': tl.getInput('requestedminorversion'),
                    'requestedpatchversion': tl.getInput('requestedpatchversion'),
                    'searchpatternpack': tl.getInput('searchpatternpack'),
                    'searchpatternpush': tl.getInput('searchpatternpush'),
                    'selectorconfig': tl.getInput('selectorconfig'),
                    'solution': tl.getInput('solution'),
                    'versioningscheme': tl.getInput('versioningscheme'),
                    'verbositypack': tl.getInput('verbositypack'),
                    'verbositypush': tl.getInput('verbositypush'),
                    'verbosityrestore': tl.getInput('verbosityrestore'),
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
        } else {
            tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum reqiurements for telemetry`);
        }
    } catch (err) {
        tl.debug(`Unable to log telemetry. Err:( ${err} )`);
    }
}

main();
