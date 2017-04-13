import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
import * as path from "path";

interface INuGetTools {
    nugetexe: INuGetVersionInfo[]
}

interface INuGetVersionInfo {
    version: string,
    url: string,
    stage: NuGetReleaseStage
}

enum NuGetReleaseStage
{
    "EarlyAccessPreview",
    "Released",
    "ReleasedAndBlessed"
}

const NUGET_TOOL_NAME: string = 'NuGet';
const NUGET_EXE_FILENAME: string = 'nuget.exe';

export const NUGET_EXE_TOOL_PATH_ENV_VAR: string = 'NuGetExeToolPath';

export async function getNuGet(versionSpec: string, checkLatest?: boolean, addNuGetToPath?: boolean): Promise<string> {
    if (toolLib.isExplicitVersion(versionSpec)) {
        // Check latest doesn't make sense when explicit version
        checkLatest = false; 
        taskLib.debug('Exact match expected on version: ' + versionSpec);
    }
    else {
        taskLib.debug('Query match expected on version: ' + versionSpec);
        console.log(taskLib.loc("Info_ExpectBehaviorChangeWhenUsingVersionQuery"));
    }

    // If we're not checking latest, check the cache first
    let toolPath: string;
    if (!checkLatest) {
        taskLib.debug('Trying to get tool from local cache');
        toolPath = toolLib.findLocalTool(NUGET_TOOL_NAME, versionSpec);
    }

    let localVersions: string[] = toolLib.findLocalToolVersions(NUGET_TOOL_NAME);
    let version: string = toolLib.evaluateVersions(localVersions, versionSpec);

    if (toolPath) {
        // If here, then we're not checking latest and we found the tool in cache
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else {
        let versionInfo: INuGetVersionInfo = await getLatestMatchVersionInfo(versionSpec);

        // There is a local version which matches the spec yet we found one on dist.nuget.org
        // which is different, so we're about to change the version which was used
        if (version && version !== versionInfo.version) {
            taskLib.warning(taskLib.loc("Warning_UpdatingNuGetVersion", versionInfo.version, version));
        }

        version = versionInfo.version;
        taskLib.debug('Found the following version from the list: ' + version);

        if (!versionInfo.url)
        {
            taskLib.error(taskLib.loc("Error_NoUrlWasFoundWhichMatches", version)); 
            throw new Error(taskLib.loc("Error_NuGetToolInstallerFailer", NUGET_TOOL_NAME));
        }

        toolPath = toolLib.findLocalTool(NUGET_TOOL_NAME, version);

        if (!toolPath) {
            taskLib.debug('Downloading version: ' + version);
            let downloadPath: string = await toolLib.downloadTool(versionInfo.url);

            taskLib.debug('Caching file');
            toolLib.cacheFile(downloadPath, NUGET_EXE_FILENAME, NUGET_TOOL_NAME, version);
        }
    }

    console.log(taskLib.loc("Info_UsingVersion", version));
    toolPath= toolLib.findLocalTool('NuGet', version);

    if (addNuGetToPath){
        console.log(taskLib.loc("Info_UsingToolPath", toolPath));
        toolLib.prependPath(toolPath);
    }

    let fullNuGetPath: string = path.join(toolPath, NUGET_EXE_FILENAME);
    taskLib.setVariable(NUGET_EXE_TOOL_PATH_ENV_VAR, fullNuGetPath);

    return fullNuGetPath;
}

function GetRestClientOptions(): restm.IRequestOptions
{
    let options: restm.IRequestOptions = <restm.IRequestOptions>{};
    options.responseProcessor = (obj: any) => {
        return obj['nuget.exe'];
    }
    return options;
}

async function getLatestMatchVersionInfo(versionSpec: string): Promise<INuGetVersionInfo> {
    taskLib.debug('Querying versions list');
        
    let versionsUrl = 'https://dist.nuget.org/tools.json';
    let rest: restm.RestClient = new restm.RestClient('vsts-tasks/NuGetToolInstaller');
    
    let nugetVersions: INuGetVersionInfo[] = (await rest.get<INuGetVersionInfo[]>(versionsUrl, GetRestClientOptions())).result;
    // x.stage is the string representation of the enum, NuGetReleaseStage.Value = number, NuGetReleaseStage[NuGetReleaseStage.Value] = string, NuGetReleaseStage[x.stage] = number
    let releasedVersions: INuGetVersionInfo[] = nugetVersions.filter(x => x.stage.toString() !== NuGetReleaseStage[NuGetReleaseStage.EarlyAccessPreview]);
    let versionStringsFromDist: string[] = releasedVersions.map(x => x.version);

    let version: string = toolLib.evaluateVersions(versionStringsFromDist, versionSpec);
    if (!version)
    {
        taskLib.error(taskLib.loc("Error_NoVersionWasFoundWhichMatches", versionSpec)); 
        taskLib.error(taskLib.loc("Info_AvailableVersions", releasedVersions.map(x => x.version).join("; ")));
        throw new Error(taskLib.loc("Error_NuGetToolInstallerFailer", NUGET_TOOL_NAME));
    }

    return releasedVersions.find(x => x.version === version);
}