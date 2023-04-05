import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as restm from 'typed-rest-client/RestClient';
import * as path from 'path';
import * as semver from 'semver';
import * as commandHelper from './CommandHelper';
import * as fs from "fs";
import * as os from "os";

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
const NUGET_SCRIPT_FILENAME: string = 'nuget';

export const FORCE_NUGET_4_0_0: string  = 'FORCE_NUGET_4_0_0';
export const NUGET_VERSION_4_0_0: string = '4.0.0';
export const NUGET_VERSION_4_0_0_PATH_SUFFIX: string = 'NuGet/4.0.0/';
export const DEFAULT_NUGET_VERSION: string = '4.1.0';
export const DEFAULT_NUGET_PATH_SUFFIX: string = 'NuGet/4.1.0/';
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
    toolPath= toolLib.findLocalTool(NUGET_TOOL_NAME, version);

    if (addNuGetToPath){
        console.log(taskLib.loc("Info_UsingToolPath", toolPath));
        toolLib.prependPath(toolPath);
    }

    let fullNuGetPath: string = path.join(toolPath, NUGET_EXE_FILENAME);
    taskLib.setVariable(NUGET_EXE_TOOL_PATH_ENV_VAR, fullNuGetPath);

    // create a nuget posix script for nuget exe in non-windows agents
    if (os.platform() !== "win32") {
        generateNugetScript(toolPath, fullNuGetPath);
    }
    
    return fullNuGetPath;
}

function generateNugetScript(nugetToolPath: string, nugetExePath: string) {
    var nugetScriptPath = path.join(nugetToolPath, NUGET_SCRIPT_FILENAME);

    if (fs.existsSync(nugetScriptPath)) {
        taskLib.debug(`nugetScriptPath already exist at ${nugetScriptPath}, skipped.`)
    } else {
        taskLib.debug(`create nugetScriptPath ${nugetScriptPath}`);

        fs.writeFile(
            nugetScriptPath,
            `#!/bin/sh\nmono ${nugetExePath} "$@"\n`,
            (err) => {
                if (err) {
                    taskLib.debug("Writing nuget script failed with error: " + err);
                } else {
                    // give read and execute permissions to everyone
                    fs.chmodSync(nugetScriptPath, "500");
                    taskLib.debug("Writing nuget script succeeded");
                }
            }
        );
    }
}

function pathExistsAsFile(path: string) {
    try {
        return taskLib.stats(path).isFile();
    } catch (error) {
        return false;
    }
}

// Based on code in Tasks\Common\MSBuildHelpers\msbuildhelpers.ts
export async function getMSBuildVersionString(): Promise<string> {
    const msbuild2019Path = 'C:/Program Files (x86)/Microsoft Visual Studio/2019/Enterprise/MSBuild/Current/Bin/msbuild.exe';
    const msbuild2022Path = 'C:/Program Files/Microsoft Visual Studio/2022/Enterprise/MSBuild/Current/Bin/msbuild.exe';
    
    let version: string;
    let path: string = taskLib.which('msbuild', false);

    // Hmmm... it's not on the path. Can we find it directly?
    if (!path && (taskLib.osType() === 'Windows_NT'))  {
        if (pathExistsAsFile(msbuild2022Path)) {
            taskLib.debug('Falling back to VS2022 install path');
            path = msbuild2022Path;
        } else if (pathExistsAsFile(msbuild2019Path)) {
            taskLib.debug('Falling back to VS2019 install path');
            path = msbuild2019Path;
        }
    }

    if (path) {
        taskLib.debug('Found msbuild.exe at: ' + path);
        const getVersionTool = taskLib.tool(path);
        getVersionTool.arg(['/version', '/nologo']);
        getVersionTool.on('stdout', (data: string) => {
            if (data) {
                version = data.toString().trim();
                taskLib.debug('Found msbuild version: ' + version);
            }
        });
        await getVersionTool.exec();
        taskLib.debug('Finished running msbuild /version /nologo');
    }
    return version;
}

export async function getMSBuildVersion(): Promise<semver.SemVer> {
    const version = await getMSBuildVersionString();
    return semver.coerce(version);
}

export async function cacheBundledNuGet(
    cachedVersionToUse?: string,
    nugetPathSuffix?: string): Promise<string> {
    if (cachedVersionToUse == null) {
        // Attempt to match nuget.exe version with msbuild.exe version
        const msbuildSemVer = await getMSBuildVersion();
        if (msbuildSemVer && semver.gte(msbuildSemVer, '16.8.0')) {
            taskLib.debug('Snapping to v5.8.0');
            cachedVersionToUse = '5.8.0';
            nugetPathSuffix = 'NuGet/5.8.0/';
        } else if (msbuildSemVer && semver.gte(msbuildSemVer, '16.5.0')) {
            taskLib.debug('Snapping to v5.4.0');
            cachedVersionToUse = '5.4.0';
            nugetPathSuffix = 'NuGet/5.4.0/';
        } else {
            cachedVersionToUse = DEFAULT_NUGET_VERSION;
        }
    }

    if (nugetPathSuffix == null) {
        nugetPathSuffix = DEFAULT_NUGET_PATH_SUFFIX;
    }

    if (taskLib.getVariable(FORCE_NUGET_4_0_0) &&
        taskLib.getVariable(FORCE_NUGET_4_0_0).toLowerCase() === "true"){
        cachedVersionToUse = NUGET_VERSION_4_0_0;
        nugetPathSuffix = NUGET_VERSION_4_0_0_PATH_SUFFIX;
    }

    if (!toolLib.findLocalTool(NUGET_TOOL_NAME, cachedVersionToUse)) {
        taskLib.debug(`Placing bundled NuGet.exe ${cachedVersionToUse} in tool lib cache`);

        let bundledNuGetLocation: string = getBundledNuGet_Location([nugetPathSuffix]);
        await toolLib.cacheFile(bundledNuGetLocation, NUGET_EXE_FILENAME, NUGET_TOOL_NAME, cachedVersionToUse);
    }

    return cachedVersionToUse;
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
    let proxyRequestOptions = {
        proxy: taskLib.getHttpProxyConfiguration(versionsUrl)
    };
    let rest: restm.RestClient = new restm.RestClient('vsts-tasks/NuGetToolInstaller', undefined, undefined, proxyRequestOptions);

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

function getBundledNuGet_Location(nugetPaths: string[]): string {
    let taskNodeModulesPath: string = path.dirname(path.dirname(__dirname));
    let taskRootPath: string = path.dirname(taskNodeModulesPath);
    const toolPath = commandHelper.locateTool("NuGet",
    <commandHelper.LocateOptions>{
        root: taskRootPath,
        searchPath: nugetPaths,
        toolFilenames: ['NuGet.exe', 'nuget.exe'],
    });

    return toolPath;
}