import * as fs from "fs";
import * as ltx from "ltx";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as locationUtilities from "../locationUtilities";
import { VersionInfo } from "../pe-parser/VersionResource";

import { IPackageSourceBase } from "./Authentication";

export function getPatternsArrayFromInput(pattern: string): string[]
{
    // make sure to remove any empty entries, or else we'll accidentally match the current directory.
    return pattern.split(";").map(x => x.trim()).filter(x => !!x);
}

// Attempts to resolve paths the same way the legacy PowerShell's Find-Files worked
export function resolveFilterSpec(
    filterSpec: string,
    basePath?: string,
    allowEmptyMatch?: boolean,
    includeFolders?: boolean): string[] {
    const patterns = getPatternsArrayFromInput(filterSpec);
    const result = new Set<string>();

    patterns.forEach((pattern) => {
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

        const thisPatternFiles = resolveWildcardPath(pattern, true, includeFolders);
        thisPatternFiles.forEach((file) => {
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

export function resolveWildcardPath(
    pattern: string,
    allowEmptyWildcardMatch?: boolean,
    includeFolders?: boolean): string[] {
    const isWindows = tl.osType() === "Windows_NT";

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
        const firstWildcardIndex = function (str) {
            const idx = str.indexOf("*");

            const idxOfWildcard = str.indexOf("?");
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }

            return idx;
        };

        // Find app files matching the specified pattern
        tl.debug("Matching glob pattern: " + pattern);

        // First find the most complete path without any matching patterns
        const idx = firstWildcardIndex(pattern);
        tl.debug("Index of first wildcard: " + idx);

        // include the wildcard character because:
        //  dirname(c:\foo\bar\) => c:\foo (which will make find() return a bunch of stuff we know we'll discard)
        //  dirname(c:\foo\bar\*) => c:\foo\bar
        const findPathRoot = path.dirname(pattern.slice(0, idx + 1));

        tl.debug("find root dir: " + findPathRoot);

        // Now we get a list of all files under this root
        const allFiles = tl.find(findPathRoot);

        // Now matching the pattern against all files
        // Turn off a bunch of minimatch features to replicate the behavior of Find-Files in the old PowerShell tasks
        const patternFilter = tl.filter(
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
        if (!includeFolders) {
            filesList = filesList.filter((x) => tl.stats(x).isFile());
        } else {
            filesList = filesList.filter((x) => tl.stats(x).isFile() || tl.stats(x).isDirectory());
        }

        // Fail if no matching .sln files were found
        if (!allowEmptyWildcardMatch && (!filesList || filesList.length === 0)) {
            throw new Error(tl.loc("Error_NoMatchingFilesFoundForPattern", pattern));
        }
    }

    if (!isWindows) {
        return filesList;
    }
    else {
        return filesList.map((file) => file.split("/").join("\\"));
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

export function resolveToolPath(path: string ): string {
    return tl.resolve(path);
}

export function locateCredentialProvider(useV2CredProvider?: boolean): string {
    let taskNodeModulesPath: string = path.dirname(path.dirname(__dirname));
    let taskRootPath: string = path.dirname(taskNodeModulesPath);

    if (useV2CredProvider === true) {
        // tslint:disable-next-line:max-line-length
        return path.join(taskRootPath, "CredentialProviderV2/plugins/netfx/CredentialProvider.Microsoft/CredentialProvider.Microsoft.exe");
    } else {
        return path.join(taskRootPath, "CredentialProvider");
    }
}

// set the console code page to "UTF-8"
export function setConsoleCodePage() {
    if (tl.osType() === "Windows_NT") {
        tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
    }
}

export async function getNuGetFeedRegistryUrl(
    packagingCollectionUrl: string,
    feedId: string,
    project: string,
    nuGetVersion: VersionInfo,
    accessToken?: string,
    useSession?: boolean): Promise<string>
{
    // If no version is received, V3 is assumed
    const registryType: locationUtilities.RegistryType = nuGetVersion && nuGetVersion.productVersion.a < 3
        ? locationUtilities.RegistryType.NuGetV2
        : locationUtilities.RegistryType.NuGetV3;

    const overwritePackagingCollectionUrl = tl.getVariable("NuGet.OverwritePackagingCollectionUrl");
    if (overwritePackagingCollectionUrl) {
        tl.debug("Overwriting packaging collection URL");
        packagingCollectionUrl = overwritePackagingCollectionUrl;
    } else if (!packagingCollectionUrl) {
        const collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
        packagingCollectionUrl = collectionUrl;
    }

    return await locationUtilities.getFeedRegistryUrl(packagingCollectionUrl, registryType, feedId, project, accessToken, useSession);
}

export function getSourcesFromNuGetConfig(configPath: string): IPackageSourceBase[] {
    // load content of the user's nuget.config
    if (!configPath) {
        return [];
    }

    tl.debug('Getting sources from NuGet.config in this location: ' + configPath);

    let xmlString = fs.readFileSync(configPath).toString();

    // strip BOM; xml parser doesn't like it
    if (xmlString.charCodeAt(0) === 0xFEFF) {
        xmlString = xmlString.substr(1);
    }

    // parse sources xml
    let xml: ltx.Element;
    try {
        xml = ltx.parse(xmlString);
    } catch (e) {
        throw new Error(tl.loc("NGCommon_NuGetConfigIsInvalid", configPath));
    }

    // give clearer errors if the user has set an invalid nuget.config
    if(!xml.nameEquals(new ltx.Element("configuration"))) {
        if(xml.nameEquals(new ltx.Element("packages"))) {
            throw new Error(tl.loc(
                "NGCommon_NuGetConfigIsPackagesConfig",
                configPath,
                tl.getVariable("Task.DisplayName")));
        }
        else {
            throw new Error(tl.loc("NGCommon_NuGetConfigIsInvalid", configPath));
        }
    }

    // check that the config contains packageSources entries
    let hasSources = false;
    let packageSources = xml.getChild("packageSources");
    let addPackageSources: ltx.Element[];
    if (packageSources) {
        addPackageSources = packageSources.getChildren("add");
        if (addPackageSources) {
            hasSources = true;
        }
    }

    if (!hasSources) {
        tl.warning(tl.loc("NGCommon_NoSourcesFoundInConfig", configPath));
        return [];
    }

    // convert to IPackageSourceBase[]
    let sources = addPackageSources.reduce((result, current) => {
        const k = current.attrs["key"];
        const v = current.attrs["value"];
        // filter out any invalid entries
        if (k != null && v != null) {
            let packageSource: IPackageSourceBase = {
                feedName: k,
                feedUri: v
            }
            result.push(packageSource);
        }
        return result;
    }, []);

    return sources;
}