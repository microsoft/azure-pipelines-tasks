import * as toolLib from 'vsts-task-tool-lib/tool';
import * as taskLib from 'vsts-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        let stableOnly: boolean = taskLib.getBoolInput('stableOnly', false);

        await getNuGet(versionSpec, stableOnly);
    }
    catch (error) {
        console.error('ERR:' + error.message);
    }
}

interface INuGetArtifacts {
    artifacts: INuGetArtifact[]
}

interface INuGetArtifact{
    name: string,
    versions: INuGetVersionInfo[]
}

interface INuGetVersionInfo {
    version: string,
    url: string
}

async function getNuGet(versionSpec: string, stableOnly: boolean) {
    toolLib.debug('Trying to get tool from local cache');
    let localVersions: string[] = toolLib.findLocalToolVersions('NuGet');
    let version: string = toolLib.evaluateVersions(localVersions, versionSpec);

    if (version) {
        console.log(taskLib.loc("Info_ResolvedToolFromCache", version));
    }
    else {
        toolLib.debug('Querying versions list');
        let versionsUrl = 'https://dist.nuget.org/index.json';
        let rest: restm.RestClient = new restm.RestClient('vsts-tasks/NuGetToolInstaller');
        let nugetArtifacts: INuGetArtifacts = (await rest.get<INuGetArtifacts>(versionsUrl)).result;
        let availableVersions: INuGetVersionInfo[] = nugetArtifacts.artifacts.find(x => x.name == "win-x86-commandline").versions;
        let versionUrlMap: Map<string, string> = new Map<string, string>();
        let filteredVersions: string[] = [];
        availableVersions.forEach((versionInfo:INuGetVersionInfo) => {
            versionUrlMap[versionInfo.version.toLowerCase()] = versionInfo.url;
        });

        if (toolLib.isExplicitVersion(versionSpec)) {
            toolLib.debug('Exact match expected on version: ' + versionSpec);
            filteredVersions = availableVersions.map(x => x.version);
        }
        else {
            toolLib.debug('Query match expected on version: ' + versionSpec);

            availableVersions.forEach((nugetVersion: INuGetVersionInfo) => {
                let isPrereleaseVersion: boolean = nugetVersion.version.indexOf('-') >= 0;

                if (isPrereleaseVersion && stableOnly) {
                    return;
                }
                
                filteredVersions.push(nugetVersion.version);
            });
        }

        version = toolLib.evaluateVersions(filteredVersions, versionSpec);
        if(!version)
        {
            toolLib.debug('No version was found which matches ' + versionSpec);
            taskLib.warning(taskLib.loc("Warning_NoVersionWasFoundWhichMatches", versionSpec)); 
            taskLib.warning(taskLib.loc("Info_AvailableVersions"));
            taskLib.warning(availableVersions.map(x => x.version).join(";"));
            throw new Error(taskLib.loc("ToolFailed", "NuGet"));
        }
        toolLib.debug('Found the following version from the list: ' + version);

        let versionDownloadUrl: string = versionUrlMap[version.toLowerCase()];
        if(!versionDownloadUrl)
        {
            toolLib.debug('No download URL was found for ' + version);
            taskLib.warning(taskLib.loc("Warning_NoUrlWasFoundWhichMatches", version)); 
            throw new Error(taskLib.loc("ToolFailed", "NuGet"));
        }

        toolLib.debug('Downloading version: ' + version);
        let downloadPath: string = await toolLib.downloadTool(versionDownloadUrl);

        toolLib.debug('Caching file');
        toolLib.cacheFile(downloadPath, "nuget.exe", "NuGet", version);
    }

    console.log(taskLib.loc("Info_UsingVersion", version));
    let toolPath: string = toolLib.findLocalTool('NuGet', version);
    console.log(taskLib.loc("Info_UsingToolPath", toolPath));
    toolLib.prependPath(toolPath);
    console.log();
}

run();