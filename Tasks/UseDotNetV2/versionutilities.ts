"use strict";
import * as path from 'path';
import * as semver from 'semver';

import * as tl from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib';

import { VersionInfo } from "./models";

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

export const validRollForwardPolicies: string[] = [
	"patch",
	"feature",
	"minor",
	"major",
	"latestPatch",
	"latestFeature",
	"latestMinor",
	"latestMajor",
	"disable",
];

/**
 * Converts an explicit SDK version and a rollForward policy into a version spec
 * suitable for the existing version resolution pipeline.
 *
 * .NET SDK versions follow the format: major.minor.featureBandPatchLevel
 *   e.g. 6.0.403 -> major=6, minor=0, featureBand=4, patchLevel=03
 *
 * @param version Explicit version from global.json (e.g. "6.0.403")
 * @param rollForward The rollForward policy from global.json
 * @returns A version spec string for use with the version fetcher
 */
export function applyRollForwardPolicy(
	version: string,
	rollForward: string,
): string {
	const parts = version.split(".");
	if (parts.length < 3) {
		return version;
	}

	const major = parts[0];
	const minor = parts[1];
	const patch = parts[2].split(/-|\+/)[0]; // strip prerelease/build metadata

	switch (rollForward) {
		case "disable":
			return version;

		case "patch":
		case "latestPatch": {
			// Same feature band, latest patch. Feature band = hundreds digit of patch.
			// e.g. 6.0.403 -> featureBand=4 -> range >=6.0.400 <6.0.500
			const featureBand = Math.floor(Number.parseInt(patch) / 100) * 100;
			return `>=${major}.${minor}.${featureBand} <${major}.${minor}.${featureBand + 100}`;
		}

		case "feature":
		case "latestFeature":
			// Any feature band within same major.minor
			return `${major}.${minor}.x`;

		case "minor":
		case "latestMinor":
			// Any minor within same major
			return `${major}.x`;

		case "major":
		case "latestMajor":
			// Latest available across all majors >= specified
			// We use major.x and let the fetcher find the latest channel
			// The caller should search across channels >= this major
			return `${major}.x`;

		default:
			return version;
	}
}

export const Constants = {
    "sdk": "sdk",
    "runtime": "runtime",
    "relativeRuntimePath": path.join("shared", "Microsoft.NETCore.App"),
    "relativeSdkPath": "sdk",
    "relativeGlobalToolPath": path.join(".dotnet", "tools")
}
