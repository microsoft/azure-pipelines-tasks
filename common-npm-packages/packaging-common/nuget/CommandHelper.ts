import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as auth from "./Authentication";
import { IPackageSource } from "./Authentication";
import * as url from "url";

export function GetExternalAuthInfoArray(inputKey: string): auth.ExternalAuthInfo[]
{
    let externalAuthArray: auth.ExternalAuthInfo[] = [];
    let endpointNames = tl.getDelimitedInput(inputKey, ',');

    if (!endpointNames || endpointNames.length === 0)
    {
        return externalAuthArray;
    }

    endpointNames.forEach((endpointName: string) => {
        let feedUri = tl.getEndpointUrl(endpointName, false);
        let feedName = feedUri.replace(/\W/g, '');
        let externalAuth = tl.getEndpointAuthorization(endpointName, true);
        let scheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();

        switch(scheme) {
            case "token":
                let token = externalAuth.parameters["apitoken"];
                tl.debug("adding token auth entry for feed " + feedUri);
                externalAuthArray.push(new auth.TokenExternalAuthInfo(<IPackageSource>
                    {
                        feedName: feedName,
                        feedUri: feedUri
                    },
                    token));
                break;
            case "usernamepassword":
                let username = externalAuth.parameters["username"];
                let password = externalAuth.parameters["password"];
                tl.debug("adding password auth entry for feed " + feedUri);
                externalAuthArray.push(new auth.UsernamePasswordExternalAuthInfo(<IPackageSource>
                    {
                        feedName: feedName,
                        feedUri: feedUri
                    },
                    username,
                    password));
                break;
            case "none":
                let apiKey = externalAuth.parameters["nugetkey"];
                tl.debug("adding apikey auth entry for feed " + feedUri);
                externalAuthArray.push(new auth.ApiKeyExternalAuthInfo(<IPackageSource>
                    {
                        feedName: feedName,
                        feedUri: feedUri
                    },
                    apiKey));
                break;
            default:
                break;
        }
    });

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

    const serverType = tl.getVariable("System.ServerType");
    if (serverType) {
        return serverType.toLowerCase() !== "hosted";
    }
    else {
        // Placed here as fallback in case the variable above is not defined
        // not an ideal way to detect hosted, but there isn't a variable for it, and
        // we can't make network calls from here due to proxy issues.
        const collectionUri = tl.getVariable("System.TeamFoundationCollectionUri");
        const parsedCollectionUri = url.parse(collectionUri);
        return !(/\.visualstudio\.com$/i.test(parsedCollectionUri.hostname));
    }
}

export function isWindowsAgent(): boolean {
    return tl.osType() === 'Windows_NT';
}
