import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as ngToolRunner from "./NuGetToolRunner";
import * as vsts from "vso-node-api/WebApi";
import {VersionInfo} from "./pe-parser/VersionResource";
import locationHelpers = require("./LocationHelpers");
import * as url from "url";
import { NuGetQuirks, NuGetQuirkName } from "./NuGetQuirks";

export function getPatternsArrayFromInput(pattern: string): string[]
{
    // make sure to remove any empty entries, or else we'll accidentally match the current directory.
    return pattern.split(";").map(x => x.trim()).filter(x => !!x);
}

// Attempts to resolve paths the same way the legacy PowerShell's Find-Files worked
export function resolveFilterSpec(filterSpec: string, basePath?: string, allowEmptyMatch?: boolean, includeFolders?: boolean): string[] {
    let patterns = getPatternsArrayFromInput(filterSpec);
    let result = new Set<string>();

    patterns.forEach(pattern => {
        let isNegative = false;
        if (pattern.startsWith("+:")) {
            pattern = pattern.substr(2);
        }
        else if (pattern.startsWith("-:")) {
            pattern = pattern.substr(2);
            isNegative = true;
        }

        if (basePath) {
            pattern = path.resolve(basePath, pattern);
        }

        tl.debug(`pattern: ${pattern}, isNegative: ${isNegative}`);

        let thisPatternFiles = resolveWildcardPath(pattern, true, includeFolders);
        thisPatternFiles.forEach(file => {
            if (isNegative) {
                result.delete(file);
            }
            else {
                result.add(file);
            }
        });
    });

    // Fail if no matching files were found
    if (!allowEmptyMatch && (!result || result.size === 0)) {
        throw new Error(tl.loc("Error_NoMatchingFilesFoundForPattern", filterSpec));
    }

    return Array.from(result);
}

export function resolveWildcardPath(pattern: string, allowEmptyWildcardMatch?: boolean, includeFolders?: boolean): string[] {
    let isWindows = tl.osType() === 'Windows_NT';

    // Resolve files for the specified value or pattern
    let filesList: string[];

    // empty patterns match nothing (otherwise they will effectively match the current directory)
    if (!pattern) {
        filesList = [];
    }
    else if (pattern.indexOf("*") === -1 && pattern.indexOf("?") === -1) {

        // No pattern found, check literal path to a single file
        tl.checkPath(pattern, "files");

        // Use the specified single file
        filesList = [pattern];

    } else {
        let firstWildcardIndex = function (str) {
            let idx = str.indexOf("*");

            let idxOfWildcard = str.indexOf("?");
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }

            return idx;
        };

        // Find app files matching the specified pattern
        tl.debug("Matching glob pattern: " + pattern);

        // First find the most complete path without any matching patterns
        let idx = firstWildcardIndex(pattern);
        tl.debug("Index of first wildcard: " + idx);

        // include the wildcard character because:
        //  dirname(c:\foo\bar\) => c:\foo (which will make find() return a bunch of stuff we know we'll discard)
        //  dirname(c:\foo\bar\*) => c:\foo\bar
        let findPathRoot = path.dirname(pattern.slice(0, idx + 1));

        tl.debug("find root dir: " + findPathRoot);

        // Now we get a list of all files under this root
        let allFiles = tl.find(findPathRoot);

        // Now matching the pattern against all files
        // Turn off a bunch of minimatch features to replicate the behavior of Find-Files in the old PowerShell tasks
        let patternFilter = tl.filter(
            pattern, {
                matchBase: true,
                nobrace: true,
                noext: true,
                nocomment: true,
                nonegate: true,
                nocase: isWindows,
                dot: isWindows,
            });

        filesList = allFiles.filter(patternFilter);

        // Avoid matching anything other than files
        if (!includeFolders)
            filesList = filesList.filter(x => tl.stats(x).isFile());
        else
            filesList = filesList.filter(x => tl.stats(x).isFile() || tl.stats(x).isDirectory());

        // Fail if no matching .sln files were found
        if (!allowEmptyWildcardMatch && (!filesList || filesList.length === 0)) {
            throw new Error(tl.loc("Error_NoMatchingFilesFoundForPattern", pattern));
        }
    }

    if (!isWindows) {
        return filesList;
    }
    else {
        return filesList.map(file => file.split("/").join("\\"));
    }
}

export function stripLeadingAndTrailingQuotes(path: string): string {
    if (path.length === 0) {
        return path;
    }

    let left = 0;
    if (path.charAt(left) === '"') {
        ++left;
    }

    let right = path.length - 1;
    if (path.charAt(right) === '"') {
        --right;
    }

    // substring returns a value *not* including the character at right
    return path.substring(left, right + 1);
}

export function getBundledNuGetLocation(uxOption: string): string {
    let nuGetDir;
    if (uxOption === "4.0.0.2283") {
        nuGetDir = "NuGet/4.0.0";
    }
    else if (uxOption === "3.5.0.1829") {
        nuGetDir = "NuGet/3.5.0";
    }
    else if (uxOption === "3.3.0") {
        nuGetDir = "NuGet/3.3.0";
    }
    else {
        throw new Error(tl.loc("NGCommon_UnabletoDetectNuGetVersion"));
    }

    const toolPath = ngToolRunner.locateTool("NuGet", {
        root: __dirname,
        searchPath: [nuGetDir],
        toolFilenames: ["NuGet.exe", "nuget.exe"],
    });

    if (!toolPath) {
        throw new Error(tl.loc("NGCommon_UnableToFindTool", "NuGet"));
    }

    return toolPath;
}

export function locateCredentialProvider(quirks?: NuGetQuirks): string {
    if (quirks && quirks.hasQuirk(NuGetQuirkName.V2CredentialProvider)) {
        return path.join(__dirname, 'NuGet/CredentialProviderV2/CredentialProvider.Microsoft.exe');
    } else {
        return path.join(__dirname, 'NuGet/CredentialProvider');
    }
}

// set the console code page to "UTF-8"
export function setConsoleCodePage() {
    if (tl.osType() === 'Windows_NT') {
        tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
    }
}

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

    let data = await Retry(async () => {
        return await coreApi.vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId: feedId });
    }, 4, 100);
    return data.requestUrl;
}

// This should be replaced when retry is implemented in vso client.
async function Retry<T>(cb : () => Promise<T>, max_retry: number, retry_delay: number) : Promise<T> {
    try {
        return await cb();
    } catch(exception) {
        tl.debug(JSON.stringify(exception));
        if(max_retry > 0)
        {
            tl.debug("Waiting " + retry_delay + "ms...");
            await delay(retry_delay);
            tl.debug("Retrying...");
            return await Retry<T>(cb, max_retry-1, retry_delay*2);
        } else {
            throw exception;
        }
    }
}
function delay(delayMs:number) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, delayMs);
    });
 }