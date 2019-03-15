import * as utils from "./versionutilities";
import * as semver from "semver";

export class VersionInfo {
    public version: string;
    public files: VersionFilesData[];

    public static getRuntimeVersion(versionInfo: VersionInfo, packageType: string): string {
        if (packageType == utils.Constants.sdk) {
            if (versionInfo["runtime-version"]) {
                return versionInfo["runtime-version"];
            }

            tl.warning(tl.loc("runtimeVersionPropertyNotFound", packageType, versionInfo.version));
        }
        else {
            return versionInfo.version;
        }

        return "";
    }
}

export class VersionFilesData {
    public name: string;
    public url: string;
    public rid: string;
    public hash?: string;
}

export class Channel {
    constructor(channelRelease: any) {
        if (!channelRelease || !channelRelease["channel-version"] || !channelRelease["releases.json"]) {
            throw "Object cannot be used as Channel, required properties such as channel-version, releases.json is missing. "
        }

        this.channelVersion = channelRelease["channel-version"];
        this.releasesJsonUrl = channelRelease["releases.json"];
    }

    channelVersion: string;
    releasesJsonUrl: string
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
        try {
            let parts = version.split('.');
            // validate version
            if (parts.length < 2 || parts.length > 3 || (parts[1] == "x" && parts.length > 2) || (parts[1] != "x" && parts.length <= 2) || !parts[0] || !parts[1] || (parts.length == 3 && !parts[2]) || Number.isNaN(Number.parseInt(parts[0])) || (Number.isNaN(Number.parseInt(parts[1])) && parts[1] != "x")) {
                throw "";
            }

            semver.Range(version);
            return true;
        }
        catch (ex) {
            tl.loc("VersionNotAllowed", version)
        }
    }

    majorVersion: string;
    minorVersion: string;
    patchVersion: string;
}