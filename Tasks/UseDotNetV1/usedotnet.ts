import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import { DotNetCoreReleaseFetcher } from "./releasesfetcher";
import * as utilities from "./utilities";
import * as auth from 'packaging-common/nuget/Authentication';
import * as commandHelper from 'packaging-common/nuget/CommandHelper';
import * as nutil from 'packaging-common/nuget/Utility';
import * as pkgLocationUtils from 'packaging-common/locationUtilities';

import * as os from 'os';
import * as path from 'path';

class DotnetCoreInstaller {
    constructor(packageType, version) {
        this.packageType = packageType;
        if (!toolLib.isExplicitVersion(version)) {
            throw tl.loc("ImplicitVersionNotSupported", version);
        }
        this.version = version;
        this.cachedToolName = this.packageType === 'runtime' ? 'dncr' : 'dncs';;
    }

    public async install() {
        // Check cache
        let toolPath: string;
        let osSuffixes = this.detectMachineOS();
        let parts = osSuffixes[0].split("-");
        this.arch = parts.length > 1 ? parts[1] : "x64";
        toolPath = this.getLocalTool();

        if (!toolPath) {
            // download, extract, cache
            console.log(tl.loc("InstallingAfresh"));
            console.log(tl.loc("GettingDownloadUrl", this.packageType, this.version));
            let downloadUrls = await DotNetCoreReleaseFetcher.getDownloadUrls(osSuffixes, this.version, this.packageType);
            toolPath = await this.downloadAndInstall(downloadUrls);
        } else {
            console.log(tl.loc("UsingCachedTool", toolPath));
        }

        // Prepend the tools path. instructs the agent to prepend for future tasks
        toolLib.prependPath(toolPath);

        try {
            let globalToolPath: string = "";
            if (tl.osType().match(/^Win/)) {
                globalToolPath = path.join(process.env.USERPROFILE, ".dotnet\\tools");
            } else {
                globalToolPath = path.join(process.env.HOME, ".dotnet/tools");
            }

            console.log(tl.loc("PrependGlobalToolPath"));
            tl.mkdirP(globalToolPath);
            toolLib.prependPath(globalToolPath);
        } catch (error) {
            //nop
        }

        // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
        tl.setVariable('DOTNET_ROOT', toolPath);
    }

    private getLocalTool(): string {
        console.log(tl.loc("CheckingToolCache"));
        return toolLib.findLocalTool(this.cachedToolName, this.version, this.arch);
    }

    private detectMachineOS(): string[] {
        let osSuffix = [];
        let scriptRunner: trm.ToolRunner;

        if (tl.osType().match(/^Win/)) {
            let escapedScript = path.join(utilities.getCurrentDir(), 'externals', 'get-os-platform.ps1').replace(/'/g, "''");
            let command = `& '${escapedScript}'`

            let powershellPath = tl.which('powershell', true);
            scriptRunner = tl.tool(powershellPath)
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);
        }
        else {
            let scriptPath = path.join(utilities.getCurrentDir(), 'externals', 'get-os-distro.sh');
            utilities.setFileAttribute(scriptPath, "777");

            scriptRunner = tl.tool(tl.which(scriptPath, true));
        }

        let result: trm.IExecSyncResult = scriptRunner.execSync();

        if (result.code != 0) {
            throw tl.loc("getMachinePlatformFailed", result.error ? result.error.message : result.stderr);
        }

        let output: string = result.stdout;

        let index;
        if ((index = output.indexOf("Primary:")) >= 0) {
            let primary = output.substr(index + "Primary:".length).split(os.EOL)[0];
            osSuffix.push(primary);
            console.log(tl.loc("PrimaryPlatform", primary));
        }

        if ((index = output.indexOf("Legacy:")) >= 0) {
            let legacy = output.substr(index + "Legacy:".length).split(os.EOL)[0];
            osSuffix.push(legacy);
            console.log(tl.loc("LegacyPlatform", legacy));
        }

        if (osSuffix.length == 0) {
            throw tl.loc("CouldNotDetectPlatform");
        }

        return osSuffix;
    }

    private async downloadAndInstall(downloadUrls: string[]) {
        let downloaded = false;
        let downloadPath = "";
        for (const url of downloadUrls) {
            try {
                downloadPath = await toolLib.downloadTool(url);
                downloaded = true;
                break;
            } catch (error) {
                tl.warning(tl.loc("CouldNotDownload", url, JSON.stringify(error)));
            }
        }

        if (!downloaded) {
            throw tl.loc("FailedToDownloadPackage");
        }

        // extract
        console.log(tl.loc("ExtractingPackage", downloadPath));
        let extPath: string = tl.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);

        // cache tool
        console.log(tl.loc("CachingTool"));
        let cachedDir = await toolLib.cacheDir(extPath, this.cachedToolName, this.version, this.arch);
        console.log(tl.loc("SuccessfullyInstalled", this.packageType, this.version));
        return cachedDir;
    }

    private packageType: string;
    private version: string;
    private cachedToolName: string;
    private arch: string;
}

function setProxy(){
    const proxyUrl = tl.getVariable("agent.proxyurl");
    const proxyUsername = tl.getVariable("agent.proxyusername");
    const proxyPassword = tl.getVariable("agent.proxypassword");

    if (!proxyUrl) {
        throw new Error('Agent proxy is not set.');
    }

    const nugetPath = tl.which('nuget');

    // Set proxy url
    let nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('--set');
    nuget.arg('http_proxy=' + proxyUrl);
    nuget.exec({} as trm.IExecOptions);

    // Set proxy username
    nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('--set');
    nuget.arg('http_proxy.user=' + proxyUsername);
    nuget.exec({} as trm.IExecOptions);

    // Set proxy password
    nuget = tl.tool(nugetPath);
    nuget.arg('config');
    nuget.arg('--set');
    nuget.arg('http_proxy.password=' + proxyPassword);
    nuget.exec({} as trm.IExecOptions);
}

async function addInternalFeed(feedName: string) {
    // Get feed info
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug('Unable to get packaging URIs, using default collection URI');
        tl.debug(JSON.stringify(error));
        const collectionUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
        packagingLocation = {
            PackagingUris: [collectionUrl],
            DefaultPackagingUri: collectionUrl
        };
    }
    const accessToken: string = pkgLocationUtils.getSystemAccessToken();
    const feedUri = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, feedName, null, accessToken, true);

    addNugetFeed(feedName, feedUri, 'VSTS');
}

async function addExternalFeed(feedName: string) {
    const externalAuthArr = commandHelper.GetExternalAuthInfoArray('externalEndpoint');
    const externalAuth = externalAuthArr[0];

    if (!externalAuth) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('Error_NoSourceSpecifiedForPush'));
        return;
    }

    const feedUri = externalAuth.packageSource.feedUri;

    const authType: auth.ExternalAuthType = externalAuth.authType;
    let apiKey = '';
    let additionalArgs: Array<string> = [];
    switch (authType) {
        case (auth.ExternalAuthType.UsernamePassword):
            const usernameInfo = externalAuth as auth.UsernamePasswordExternalAuthInfo;
            additionalArgs = ['-UserName', usernameInfo.username, '-Password', usernameInfo.password];
            break;
        case (auth.ExternalAuthType.Token):
            apiKey = 'RequiredApiKey';
            break;
        case (auth.ExternalAuthType.ApiKey):
            const apiKeyAuthInfo = externalAuth as auth.ApiKeyExternalAuthInfo;
            apiKey = apiKeyAuthInfo.apiKey;
            break;
        default:
            break;
    }

    addNugetFeed(feedName, feedUri, apiKey, additionalArgs);
}

function addNugetFeed(feedName: string, feedUri: string, apiKey: string = '', additionalArgs: Array<string> = []) {
    const nugetPath = tl.which('nuget');

    // Add feed
    let nuget = tl.tool(nugetPath);
    nuget.arg('sources');
    nuget.arg('Add');
    
    nuget.arg('-Name');
    nuget.arg(feedName);
    
    nuget.arg('-Source');
    nuget.arg(feedUri);

    additionalArgs.forEach(arg => {
        nuget.arg(arg);
    });

    nuget.arg('-NonInteractive');

    nuget.exec({} as trm.IExecOptions);

    if (apiKey) {
        nuget = tl.tool(nugetPath);
        nuget.arg('setapikey');
        nuget.arg(apiKey);

        nuget.arg('-Source');
        nuget.arg(feedUri);

        nuget.arg('-NonInteractive');

        nuget.exec({} as trm.IExecOptions);
    }
}

async function run() {
    // set the console code page to "UTF-8"
    if (tl.osType() === 'Windows_NT') {
        try {
            tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
        }
        catch (ex) {
            tl.warning(tl.loc("CouldNotSetCodePaging", JSON.stringify(ex)));
        }
    }

    let packageType = tl.getInput('packageType') || 'sdk';
    const version: string = tl.getInput('version');
    if (version) {
        console.log(tl.loc("ToolToInstall", packageType, version));
        await new DotnetCoreInstaller(packageType, version).install();
    }

    const proxy: boolean = tl.getBoolInput('proxy');
    if (proxy) {
        setProxy();
    }

    const feed: string = tl.getInput('auth');
    tl.warning("AUTH="+feed);
    if (feed) {
        // Get the info the type of feed
        let nugetFeedType = tl.getInput('nuGetFeedType') || 'internal';

        // Make sure the feed type is an expected one
        const normalizedNuGetFeedType = ['internal', 'external'].find(x => nugetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc('UnknownFeedType', nugetFeedType));
        }
        nugetFeedType = normalizedNuGetFeedType;

        throw 'This shouldnt get called most times';

        // if (nugetFeedType === 'internal') {
        //     await addInternalFeed(feed);
        // }
        // else {
        //     await addExternalFeed(feed);
        // }
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));