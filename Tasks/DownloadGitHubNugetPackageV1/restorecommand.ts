import * as tl from 'azure-pipelines-task-lib/task';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import * as fs from "fs";
import * as ltx from "ltx";
import * as auth from 'azure-pipelines-tasks-packaging-common/nuget/Authentication';
import { NuGetConfigHelper2 } from 'azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper2';
import * as ngRunner from 'azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner2';
import * as path from 'path';
import * as Q from 'q';
import * as httpClient from 'typed-rest-client/HttpClient';

export async function run(): Promise<void> {
    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;

    try {
        let packageName: string = tl.getInput("packageName");
        let packageVersion: string = tl.getInput("version") || "";

        if (!packageName || packageName.indexOf("/") < 0)
        {
            throw Error(tl.loc('Error_InvalidPackageName'));
        }
        else {
            packageName = packageName.split("/")[1];
        }

        let endpointNames = tl.getDelimitedInput("externalEndpoints", ',');
        const username: string = await GetGitHubUser(endpointNames[0]); // we will always have a single connection

        const noCache = true;
        const verbosity = "minimal";
        let packagesDirectory = tl.getPathInput('packagesDirectory');
        if (!tl.filePathSupplied('packagesDirectory')) {
            packagesDirectory = null;
        }

        const externalAuthArr: auth.ExternalAuthInfo[] = GetExternalAuthInfoArray('externalEndpoints', username);
        const authInfo = new auth.NuGetExtendedAuthInfo(null, externalAuthArr);

        // Setting up sources, either from provided config file or from feed selection
        tl.debug('Setting up sources');

        // If there was no nuGetConfigPath, NuGetConfigHelper will create one
        const nuGetConfigHelper = new NuGetConfigHelper2(
            null,
            null,
            authInfo,
            { credProviderFolder: null, extensionsDisabled: true },
            getTempNuGetConfigPath() /* tempConfigPath */,
            false /* useNugetToModifyConfigFile */);

        let credCleanup = () => { return; };

        const sources: Array<auth.IPackageSource> = new Array<auth.IPackageSource>();
        let feedUri: string = "https://nuget.pkg.github.com/" + username + "/index.json";
        sources.push(<auth.IPackageSource>
            {
                feedName: "github",
                feedUri: feedUri,
                isInternal: false
            });

        // Creating NuGet.config for the user
        if (sources.length > 0) {
            tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`);
            nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
            credCleanup = () => {
                tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            };
        } else {
            tl.debug('No sources were added to the temp NuGet.config file');
        }

        // Setting creds in the temp NuGet.config if needed
        nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();
        const configFile = nuGetConfigHelper.tempNugetConfigPath;
        nuGetConfigHelper.backupExistingRootNuGetFiles();
        const dotnetPath = tl.which('dotnet', true);

        let projectFiles = CreateProjectFiles(configFile);

        try {
            for (const projectFile of projectFiles) {
                await dotnetAddAsync(dotnetPath, projectFile, packageName, packageVersion, configFile);
                await dotNetRestoreAsync(dotnetPath, projectFile, packagesDirectory, configFile, noCache, verbosity);
            }
        } finally {
            credCleanup();
            nuGetConfigHelper.restoreBackupRootNuGetFiles();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PackagesInstalledSuccessfully'));

    } catch (err) {
        tl.error(err);
        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc('BuildIdentityPermissionsHint', buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackageFailedToInstall'));
    }
}

function getTempNuGetConfigPath(): string {
    const tempNuGetConfigBaseDir = tl.getVariable("Agent.BuildDirectory") || tl.getVariable("Agent.TempDirectory");
    const tempNuGetConfigFileName =  "nuget.config";
    return path.join(tempNuGetConfigBaseDir, "Nuget", "dotnet", tempNuGetConfigFileName);
}

function CreateProjectFiles(configPath: string): string[] {
    let projectFilePath: string = getProjectFilePath(configPath);
    tl.writeFile(projectFilePath, "<Project Sdk=\"Microsoft.NET.Sdk\" />");

    updateXmlFile(projectFilePath, (xml: any): any => {
        if (xml) {
            if (xml.getName().toLowerCase() !== "project") {
                throw Error("Expected project element");
            }
            let xmlPropertyGroup = getOrCreateLastElement(xml, "PropertyGroup");
            let xmlOutputType = xmlPropertyGroup.c("OutputType");
            let xmlTargetFramework = xmlPropertyGroup.c("TargetFramework");
            let xmlOutputTypeTxt = xmlOutputType.t("Exe");
            let xmlTargetFrameworkTxt = xmlTargetFramework.t("netcoreapp2.1");
        }

        return xml;
        
    });

    return [projectFilePath];
}

function updateXmlFile(xmlPath: string, updateFn: (xml: any) => any): void {
    let xmlString = fs.readFileSync(xmlPath).toString();

    // strip BOM; xml parser doesn't like it
    if (xmlString.charCodeAt(0) === 0xFEFF) {
        xmlString = xmlString.substr(1);
    }

    let xml = ltx.parse(xmlString);
    xml = updateFn(xml);
    fs.writeFileSync(xmlPath, xml.root().toString());
}

function getProjectFilePath(configPath: string): string {
    const tempNuGetConfigBaseDir = path.dirname(configPath);
    const tempNuGetConfigFileName = "tempCsproj_" + tl.getVariable("build.buildId") + ".csproj";
    return path.join(tempNuGetConfigBaseDir, tempNuGetConfigFileName);
}

/**
 * Gets the last element in xml that matches elementName. If no existing element is found,
 * one will be created on the root of xml
 * @param xml Xml Element to search
 * @param elementName Element name to return or create
 */
function getOrCreateLastElement(xml: any, elementName: string): any {
    if (xml) {
        let xmlElements = xml.getChildren(elementName);
        if (!xmlElements || xmlElements.length === 0) {
            xmlElements = [xml.c(elementName)];
        }

        return xmlElements[xmlElements.length - 1];
    }
}

function GetExternalAuthInfoArray(inputKey: string, username: string): auth.ExternalAuthInfo[]
{
    let externalAuthArray: auth.ExternalAuthInfo[] = [];
    let endpointNames = tl.getDelimitedInput(inputKey, ',');

    if (!endpointNames || endpointNames.length === 0)
    {
        return externalAuthArray;
    }

    endpointNames.forEach((endpointName: string) => {
        let externalAuth = tl.getEndpointAuthorization(endpointName, true);
        let scheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();
        let token = "";
        switch(scheme) {
            case "token":
                token = externalAuth.parameters["AccessToken"];
                tl.debug("adding token auth entry for feed GitHub");
                externalAuthArray.push(new auth.TokenExternalAuthInfo(<auth.IPackageSource>
                    {
                        feedName: "github",
                        feedUri: "https://nuget.pkg.github.com/" + username + "/index.json"
                    },
                    token));
                break;
            case "personalaccesstoken":
                token = externalAuth.parameters["accessToken"];                
                tl.debug("adding token auth entry for feed GitHub");
                externalAuthArray.push(new auth.TokenExternalAuthInfo(<auth.IPackageSource>
                    {
                        feedName: "github",
                        feedUri: "https://nuget.pkg.github.com/" + username + "/index.json"
                    },
                    token));
                break;
            case "usernamepassword":
            case "none":
                break;
            default:
                break;
        }
    });

    return externalAuthArray;
}

async function GetGitHubUser(endpointId: string): Promise<string> {
    let externalAuth = tl.getEndpointAuthorization(endpointId, true);
    let scheme = tl.getEndpointAuthorizationScheme(endpointId, true).toLowerCase();

    if (!(scheme === 'token' || scheme === 'personalaccesstoken')) {
        return '';
    }

    let token = '';
    if (scheme === 'token') {
        token = externalAuth.parameters['AccessToken'];
    } else if (scheme === 'personalaccesstoken') {
        token = externalAuth.parameters['accessToken'];
    }

    const http = new httpClient.HttpClient('typed-rest-client');

    const res = await http.get('https://api.github.com/user', {
        'Authorization': `Token ${token}`,
        'User-Agent': 'azure-pipelines'
    });

    const body: string = await res.readBody();
    const json: { login: string } = JSON.parse(body) || { login: '' };

    return json.login;
}

function dotnetAddAsync(dotnetPath: string, projectFile: string, packageName: string, version: string, configFile: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);
    dotnet.arg('add');

    if (projectFile) {
        dotnet.arg(projectFile);
    }

    if (packageName) {
        dotnet.arg('package');
        dotnet.arg(packageName);
    }

    if (version) {
        dotnet.arg('-v');
        dotnet.arg(version);
    }

    dotnet.arg('-n');

    const envWithProxy = ngRunner.setNuGetProxyEnvironment(process.env, configFile, null);
    return dotnet.exec({ cwd: path.dirname(projectFile), env: envWithProxy } as IExecOptions);
}

function dotNetRestoreAsync(dotnetPath: string, projectFile: string, packagesDirectory: string, configFile: string, noCache: boolean, verbosity: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);
    dotnet.arg('restore');

    if (projectFile) {
        dotnet.arg(projectFile);
    }

    if (packagesDirectory) {
        dotnet.arg('--packages');
        dotnet.arg(packagesDirectory);
    }

    dotnet.arg('--configfile');
    dotnet.arg(configFile);

    if (noCache) {
        dotnet.arg('--no-cache');
    }

    if (verbosity && verbosity !== '-') {
        dotnet.arg('--verbosity');
        dotnet.arg(verbosity);
    }

    const envWithProxy = ngRunner.setNuGetProxyEnvironment(process.env, configFile, null);
    return dotnet.exec({ cwd: path.dirname(projectFile), env: envWithProxy } as IExecOptions);
}
