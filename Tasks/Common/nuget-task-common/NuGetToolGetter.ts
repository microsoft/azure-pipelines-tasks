import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';

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

export async function getNuGet(versionSpec: string) {
    if (toolLib.isExplicitVersion(versionSpec)) {
        taskLib.debug('Exact match expected on version: ' + versionSpec);
    }
    else {
        taskLib.debug('Query match expected on version: ' + versionSpec);
        console.log(taskLib.loc("Info_ExpectBehaviorChangeWhenUsingVersionQuery"));
    }

    let localVersions: string[] = toolLib.findLocalToolVersions('NuGet');
    let version: string = toolLib.evaluateVersions(localVersions, versionSpec);
    taskLib.debug('Trying to get tool from local cache');
    if (version) {
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else {
        taskLib.debug('Querying versions list');
        
        let versionsUrl = 'https://dist.nuget.org/tools.json';
        let rest: restm.RestClient = new restm.RestClient('vsts-tasks/NuGetToolInstaller');
        
        let nugetVersions: INuGetVersionInfo[] = (await rest.get<INuGetVersionInfo[]>(versionsUrl, GetRestClientOptions())).result;
        let availableVersions: INuGetVersionInfo[] = nugetVersions.filter(x => x.stage !== NuGetReleaseStage.EarlyAccessPreview);
        let filteredVersions: string[] = availableVersions.map(x => x.version);
        let versionUrlMap: Map<string, string> = new Map<string, string>();
        availableVersions.forEach((versionInfo:INuGetVersionInfo) => {
            versionUrlMap[versionInfo.version.toLowerCase()] = versionInfo.url;
        });

        version = toolLib.evaluateVersions(filteredVersions, versionSpec);
        if(!version)
        {
            taskLib.error(taskLib.loc("Error_NoVersionWasFoundWhichMatches", versionSpec)); 
            taskLib.error(taskLib.loc("Info_AvailableVersions"));
            taskLib.error(availableVersions.map(x => x.version).join(";"));
            throw new Error(taskLib.loc("Error_NuGetToolInstallerFailer", "NuGet"));
        }
        taskLib.debug('Found the following version from the list: ' + version);

        let versionDownloadUrl: string = versionUrlMap[version.toLowerCase()];
        if(!versionDownloadUrl)
        {
            taskLib.error(taskLib.loc("Error_NoUrlWasFoundWhichMatches", version)); 
            throw new Error(taskLib.loc("Error_NuGetToolInstallerFailer", "NuGet"));
        }

        taskLib.debug('Downloading version: ' + version);
        let downloadPath: string = await toolLib.downloadTool(versionDownloadUrl);

        taskLib.debug('Caching file');
        toolLib.cacheFile(downloadPath, "nuget.exe", "NuGet", version);
    }

    console.log(taskLib.loc("Info_UsingVersion", version));
    let toolPath: string = toolLib.findLocalTool('NuGet', version);
    console.log(taskLib.loc("Info_UsingToolPath", toolPath));
    toolLib.prependPath(toolPath);
    console.log();
}

function GetRestClientOptions(): restm.IRequestOptions
{
    let options: restm.IRequestOptions = <restm.IRequestOptions>{};
    options.responseProcessor = (obj: any) => {
        return obj['nuget.exe'];
    }
    return options;
}