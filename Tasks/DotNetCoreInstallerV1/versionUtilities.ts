import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib';

export function versionCompareFunction(versionA: string, versionB: string): number {
    if (!toolLib.isExplicitVersion(versionA) || !toolLib.isExplicitVersion(versionA)) {
        throw tl.loc("ExplicitVersionRequiredForComparison", versionA, versionB);
    }

    var versionAParts = new VersionParts(versionA);
    var versionBParts = new VersionParts(versionB);

    if (versionAParts.majorVersion != versionBParts.majorVersion) {
        return Number.parseInt(versionAParts.majorVersion) > Number.parseInt(versionBParts.majorVersion) ? 1 : -1;
    }
    else if (versionAParts.minorVersion != versionBParts.minorVersion) {
        return Number.parseInt(versionAParts.minorVersion) > Number.parseInt(versionBParts.minorVersion) ? 1 : -1;
    }
    else if (versionAParts.patchVersion != versionBParts.patchVersion) {
        let versionAPatchParts = versionAParts.patchVersion.split("-");
        let versionBPatchParts = versionBParts.patchVersion.split("-");
        if (Number.parseInt(versionAPatchParts[0]) != Number.parseInt(versionBPatchParts[0])) {
            return Number.parseInt(versionAPatchParts[0]) > Number.parseInt(versionBPatchParts[0]) ? 1 : -1;
        }

        if (versionAPatchParts.length == versionBPatchParts.length && versionAPatchParts.length == 3) {
            if (Number.parseInt(versionAPatchParts[2]) != Number.parseInt(versionBPatchParts[2])) {
                return Number.parseInt(versionAPatchParts[2]) > Number.parseInt(versionBPatchParts[2]) ? 1 : -1;
            }
        }

        return versionAParts.patchVersion > versionBParts.patchVersion ? 1 : -1;
    }

    return 0;
}

export class VersionParts {
    constructor(version: string) {
        VersionParts.ValidateVersionSpec(version);
        let parts: string[] = version.split(".");

        this.majorVersion = parts[0];
        this.minorVersion = parts[1];
        this.patchVersion = "";
        if (this.minorVersion != "x") {
            this.patchVersion = parts[2];
        }
    }

    public static ValidateVersionSpec(version): boolean {
        let parts: string[] = version.split('.');
        // validate version
        if (parts.length < 2 || parts.length > 3 || parts[0] == "x" || (parts[1] == "x" && parts.length > 2) || (parts[1] != "x" && parts.length <= 2) ) {
            throw tl.loc("VersionNotAllowed", version)
        }

        return true;
    }

    majorVersion: string;
    minorVersion: string;
    patchVersion: string;
}