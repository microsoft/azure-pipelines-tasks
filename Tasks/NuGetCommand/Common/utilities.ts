import * as path from "path";
import * as vsts from "vso-node-api/WebApi";
import locationHelpers = require("nuget-task-common/LocationHelpers");
import {VersionInfo} from "nuget-task-common/pe-parser/VersionResource";
import * as tl from "vsts-task-lib/task";
import * as auth from "./Authentication";
import { IPackageSource } from "./Authentication";
import * as url from "url";

export async function getNuGetFeedRegistryUrl(accessToken:string, feedId: string, nuGetVersion: VersionInfo): Promise<string>
{
    const ApiVersion = "3.0-preview.1";
    let PackagingAreaName: string = "nuget";
    // If no version is received, V3 is assumed
    let PackageAreaId: string = nuGetVersion && nuGetVersion.productVersion.a < 3 ? "5D6FC3B3-EF78-4342-9B6E-B3799C866CFA" : "9D3A4E8E-2F8F-4AE1-ABC2-B461A51CB3B3";

 	let credentialHandler = vsts.getBearerHandler(accessToken);
    let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    // The second element contains the transformed packaging URL
    let packagingCollectionUrl = (await locationHelpers.assumeNuGetUriPrefixes(collectionUrl))[1];
    
    if (!packagingCollectionUrl)
    {
        packagingCollectionUrl = collectionUrl;
    }

    const overwritePackagingCollectionUrl = tl.getVariable("NuGet.OverwritePackagingCollectionUrl");
    if (overwritePackagingCollectionUrl) {
        tl.debug("Overwriting packaging collection URL");
        packagingCollectionUrl = overwritePackagingCollectionUrl;
    }
    
 	let vssConnection = new vsts.WebApi(packagingCollectionUrl, credentialHandler);
 	let coreApi = vssConnection.getCoreApi();

    let data = await coreApi.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId: feedId });

    return data.requestUrl;
}

export function GetExternalAuthInfo(inputKey: string): auth.ExternalAuthInfo
{
    let externalAuthArray: auth.ExternalAuthInfo = undefined;
    let endpointName = tl.getInput(inputKey);
    let feedUri = tl.getEndpointUrl(endpointName, true);
    let feedName = feedUri.replace(/\W/g, '');
    let externalAuth = tl.getEndpointAuthorization(endpointName, true);
    let scheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();

    switch(scheme) {
        case "token":
            let token = externalAuth.parameters["apitoken"]; 
            externalAuthArray = new auth.TokenExternalAuthInfo(<IPackageSource>
                {
                    feedName: feedName,
                    feedUri: feedUri
                }, 
                token);
            break;
        case "usernamepassword":
            let username = externalAuth.parameters["username"];
            let password = externalAuth.parameters["password"];
            externalAuthArray = new auth.UsernamePasswordExternalAuthInfo(<IPackageSource>
                {
                    feedName: feedName,
                    feedUri: feedUri
                }, 
                username, 
                password);
            break;
        case "none":
            let apiKey = externalAuth.parameters["nugetkey"];
            externalAuthArray = new auth.ApiKeyExternalAuthInfo(<IPackageSource>
                {
                    feedName: feedName,
                    feedUri: feedUri
                }, 
                apiKey);
            break;
        default:
            break;
    }

    return externalAuthArray;
}

export function GetExternalAuthInfoArray(inputKey: string): auth.ExternalAuthInfo[]
{
    let externalAuthArray: auth.ExternalAuthInfo[] = [];
    let endpointName = tl.getInput(inputKey);

    if (!endpointName)
    {
        return externalAuthArray;
    }

    let externalAuthInfo = this.GetExternalAuthInfo(inputKey);
    if (externalAuthInfo)
    {
        externalAuthArray = [externalAuthInfo];
    }

    return externalAuthArray;
}

export interface LocateOptions {
    /** if true, search along the system path in addition to the hard-coded NuGet tool paths */
    fallbackToSystemPath?: boolean;

    /** Array of filenames to use when searching for the tool. Defaults to the tool name. */
    toolFilenames?: string[];

    /** Array of paths to search under. Defaults to agent NuGet locations */
    searchPath?: string[];

    /** root that searchPaths are relative to. Defaults to the Agent.HomeDirectory build variable */
    root?: string;
}

export function locateTool(tool: string, opts?: LocateOptions) {
    const defaultSearchPath = [""];
    const defaultAgentRoot = tl.getVariable("Agent.HomeDirectory");

    opts = opts || {};
    opts.toolFilenames = opts.toolFilenames || [tool];

    let searchPath = opts.searchPath || defaultSearchPath;
    let agentRoot = opts.root || defaultAgentRoot;

    tl.debug(`looking for tool ${tool}`);

    for (let thisVariant of opts.toolFilenames) {
        tl.debug(`looking for tool variant ${thisVariant}`);

        for (let possibleLocation of searchPath) {
            let fullPath = path.join(agentRoot, possibleLocation, thisVariant);
            tl.debug(`checking ${fullPath}`);
            if (tl.exist(fullPath)) {
                return fullPath;
            }
        }

        if (opts.fallbackToSystemPath) {
            tl.debug("Checking system path");
            let whichResult = tl.which(thisVariant);
            if (whichResult) {
                tl.debug(`found ${whichResult}`);
                return whichResult;
            }
        }

        tl.debug("not found");
    }

    return null;
}

export function isOnPremisesTfs(): boolean {
    if(tl.getVariable("NuGetTasks.IsHostedTestEnvironment") === "true") {
        return false;
    }

    // not an ideal way to detect hosted, but there isn't a variable for it, and we can't make network calls from here
    // due to proxy issues.
    const collectionUri = tl.getVariable("System.TeamFoundationCollectionUri");
    const parsedCollectionUri = url.parse(collectionUri);
    return !(/\.visualstudio\.com$/i.test(parsedCollectionUri.hostname));
}