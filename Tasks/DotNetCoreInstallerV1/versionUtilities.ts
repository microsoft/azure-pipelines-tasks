import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib';

export function getVersionParts(version: string): { majorVersion: string, minorVersion: string, patchVersion: string } {
    let versionParts: string[] = version.split('.');
    if (versionParts.length < 2) {
        throw tl.loc("VersionNotAllowed", version)
    }

    let majorVersion = versionParts[0];
    let minorVersion = versionParts[1];
    let patchVersion = "";
    if (minorVersion != "x" && versionParts.length > 2) {
        patchVersion = versionParts[2];
    }
    else {
        throw tl.loc("VersionNotAllowed", version);
    }

    return { "majorVersion": majorVersion, "minorVersion": minorVersion, "patchVersion": patchVersion };
}

export function versionCompareFunction(versionA: string, versionB: string): number {
    if (!toolLib.isExplicitVersion(versionA) || !toolLib.isExplicitVersion(versionA)) {
        console.log(tl.loc("ExplicitVersionRequiredForComparison", versionA, versionB));
        throw tl.loc("ExplicitVersionRequiredForComparison", versionA, versionB);
    }

    var versionAParts = getVersionParts(versionA);
    var versionBParts = getVersionParts(versionB);

    if (versionAParts.majorVersion != versionBParts.majorVersion) {
        return versionAParts.majorVersion > versionBParts.majorVersion ? 1 : -1;
    }
    else if (versionAParts.minorVersion != versionBParts.minorVersion) {
        return versionAParts.minorVersion > versionBParts.minorVersion ? 1 : -1;
    }
    else if (versionAParts.patchVersion != versionBParts.patchVersion) {
        return versionAParts.patchVersion > versionBParts.patchVersion ? 1 : -1;
    }

    return 0;
}