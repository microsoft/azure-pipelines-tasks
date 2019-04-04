import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib';
import * as semver from 'semver';
import { VersionInfo } from "./models"

export function versionCompareFunction(versionA: string, versionB: string): number {
    if (!toolLib.isExplicitVersion(versionA) || !toolLib.isExplicitVersion(versionB)) {
        throw tl.loc("VersionsCanNotBeCompared", versionA, versionB);
    }

    return semver.compare(versionA, versionB);
}

export function compareChannelVersion(channelVersionA: string, channelVersionB: string): number {
    if (!channelVersionA || !channelVersionB) {
        throw "One channel version is missing"
    }

    let channelVersionAParts = channelVersionA.split(".");
    let channelVersionBParts = channelVersionB.split(".");
    if (channelVersionAParts.length != 2 || channelVersionBParts.length != 2) {
        throw tl.loc("ChannelVersionsNotComparable", channelVersionA, channelVersionB)
    }

    let channelAMajorVersion = Number.parseInt(channelVersionAParts[0]);
    let channelAMinorVersion = Number.parseInt(channelVersionAParts[1]);
    let channelBMajorVersion = Number.parseInt(channelVersionBParts[0]);
    let channelBMinorVersion = Number.parseInt(channelVersionBParts[1]);

    if (Number.isNaN(channelAMajorVersion) || Number.isNaN(channelAMinorVersion) || Number.isNaN(channelBMajorVersion) || Number.isNaN(channelBMinorVersion)) {
        throw tl.loc("ChannelVersionsNotComparable", channelVersionA, channelVersionB);
    }

    if (channelAMajorVersion != channelBMajorVersion) {
        return channelAMajorVersion > channelBMajorVersion ? 1 : -1;
    }
    else if (channelAMinorVersion != channelBMinorVersion) {
        return channelAMinorVersion > channelBMinorVersion ? 1 : -1;
    }

    return 0;
}

export function getMatchingVersionFromList(versionInfoList: VersionInfo[], versionSpec: string, includePreviewVersions: boolean = false): VersionInfo {
    let versionList: string[] = [];
    versionInfoList.forEach(versionInfo => {
        if (versionInfo && versionInfo.getVersion()) {
            versionList.push(versionInfo.getVersion());
        }
    });

    if (versionList.length > 0) {
        let matchedVersion = semver.maxSatisfying(versionList, versionSpec, { includePrerelease: includePreviewVersions });
        if (matchedVersion) {
            return versionInfoList.find(versionInfo => {
                return versionInfo.getVersion() == matchedVersion
            });
        }
    }

    return null;
}

export const Constants = {
    "sdk": "sdk",
    "runtime": "runtime",
    "relativeRuntimePath": path.join("shared", "Microsoft.NETCore.App"),
    "relativeSdkPath": "sdk",
    "relativeGlobalToolPath": path.join(".dotnet", "tools")
}