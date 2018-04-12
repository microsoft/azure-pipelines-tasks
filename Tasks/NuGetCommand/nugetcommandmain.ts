import * as tl from "vsts-task-lib/task";
import * as path from "path";

import * as nugetRestore from './nugetrestore';
import * as nugetPublish from './nugetpublisher';
import * as nugetPack from './nugetpack';
import * as nugetCustom from './nugetcustom';
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");
import * as telemetry from 'utility-common/telemetry';
import * as peParser from "nuget-task-common/pe-parser";
import {VersionInfo} from "nuget-task-common/pe-parser/VersionResource"

const NUGET_EXE_CUSTOM_LOCATION: string = "NuGetExeCustomLocation";

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    // Getting NuGet
    tl.debug('Getting NuGet');
    let nuGetPath: string = undefined;
    let nugetVersion: string = undefined;
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
        let nugetVersionInfo: VersionInfo  = await peParser.getFileVersionInfoAsync(nuGetPath);
        if (nugetVersionInfo && nugetVersionInfo.fileVersion){
            nugetVersion = nugetVersionInfo.fileVersion.toString();
        }
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    } finally{
        _logNugetStartupVariables(nuGetPath, nugetVersion);
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

function _logNugetStartupVariables(nuGetPath: string, nugetVersion: string) {
    try {
        const nugetfeedtype = tl.getInput("nugetfeedtype");
        let externalendpoint = null;
        if (nugetfeedtype != null && nugetfeedtype === "external") {
            const epId = tl.getInput("externalendpoint");
            if (epId) {
                externalendpoint = {
                    feedName: tl.getEndpointUrl(epId, false).replace(/\W/g, ''),
                    feedUri: tl.getEndpointUrl(epId, false),
                };
            }
        }

        let externalendpoints = tl.getDelimitedInput('externalendpoints', ',');
        if (externalendpoints) {
            externalendpoints = externalendpoints.reduce((ary, id) => {
                const te = {
                    feedName: tl.getEndpointUrl(id, false).replace(/\W/g, ''),
                    feedUri: tl.getEndpointUrl(id, false),
                };
                ary.push(te);
                return ary;
            }, []);
        }
        let nugetTelem = {
                'command': tl.getInput('command'),
                'NUGET_EXE_TOOL_PATH_ENV_VAR': tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
                'NUGET_EXE_CUSTOM_LOCATION': tl.getVariable(NUGET_EXE_CUSTOM_LOCATION),
                'searchPatternPack': tl.getPathInput('searchPatternPack'),
                'configurationToPack': tl.getInput('configurationToPack'),
                'versioningScheme': tl.getInput('versioningScheme'),
                'includeReferencedProjects': tl.getBoolInput('includeReferencedProjects'),
                'versionEnvVar': tl.getInput('versioningScheme') === 'byEnvVar' ?
                    tl.getVariable(tl.getInput('versionEnvVar')) : null,
                'requestedMajorVersion': tl.getInput('requestedMajorVersion'),
                'requestedMinorVersion': tl.getInput('requestedMinorVersion'),
                'requestedPatchVersion': tl.getInput('requestedPatchVersion'),
                'packTimezone': tl.getInput('packTimezone'),
                'buildProperties': tl.getInput('buildProperties'),
                'basePath': tl.getInput('basePath'),
                'verbosityPack': tl.getInput('verbosityPack'),
                'includeSymbols': tl.getBoolInput('includeSymbols'),
                'NuGet.UseLegacyFindFiles': tl.getVariable('NuGet.UseLegacyFindFiles'),
                'NuGetTasks.IsHostedTestEnvironment': tl.getVariable('NuGetTasks.IsHostedTestEnvironment'),
                'System.TeamFoundationCollectionUri': tl.getVariable('System.TeamFoundationCollectionUri'),
                'NuGet.OverwritePackagingCollectionUrl': tl.getVariable('NuGet.OverwritePackagingCollectionUrl'),
                'externalendpoint': externalendpoint,
                'externalendpoints': externalendpoints,
                'allowpackageconflicts': tl.getInput('allowpackageconflicts'),
                'includenugetorg': tl.getInput('includenugetorg'),
                'nocache': tl.getInput('nocache'),
                'disableparallelprocessing': tl.getInput('disableParallelProcessing'),
                'nugetconfigpath': tl.getInput('nugetconfigpath'),
                'nugetfeedtype': nugetfeedtype,
                'searchpatternpush': tl.getInput('searchpatternpush'),
                'selectorconfig': tl.getInput('selectorconfig'),
                'solution': tl.getInput('solution'),
                'verbositypush': tl.getInput('verbositypush'),
                'verbosityrestore': tl.getInput('verbosityrestore'),
                'nuGetPath': nuGetPath,
                'nugetVersion': nugetVersion
            };

        telemetry.emitTelemetry('Packaging', 'NuGetCommand', nugetTelem);
    } catch (err) {
        tl.debug(`Unable to log NuGet task init telemetry. Err:( ${err} )`);
    }
}

main();
