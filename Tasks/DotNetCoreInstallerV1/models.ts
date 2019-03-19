import * as semver from "semver";
import * as url from "url";

import * as tl from 'vsts-task-lib/task';

import * as utils from "./versionutilities";

export class VersionInfo {
    public version: string;
    public files: VersionFilesData[];

    constructor(versionInfoObject: any) {
        this.version = versionInfoObject.version;
        this.files = versionInfoObject.files;
    }

    public getRuntimeVersion(packageType: string): string {
        if (packageType == utils.Constants.sdk) {
            return this["runtime-version"] || "";
        }
        else {
            return this.version || "";
        }
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
            throw tl.loc("InvalidChannelObject");
        }

        this.channelVersion = channelRelease["channel-version"];
        this.releasesJsonUrl = channelRelease["releases.json"];
    }

    public channelVersion: string;
    public releasesJsonUrl: string;
}

export class VersionParts {
    constructor(version: string) {
        VersionParts.ValidateVersionSpec(version);
        let parts: string[] = version.split(".");

        this.versionSpec = version;
        this.majorVersion = parts[0];
        this.minorVersion = parts[1];
        this.patchVersion = "";
        if (this.minorVersion != "x") {
            this.patchVersion = parts[2];
        }
    }

    private static ValidateVersionSpec(version): boolean {
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
            throw tl.loc("VersionNotAllowed", version)
        }
    }

    public majorVersion: string;
    public minorVersion: string;
    public patchVersion: string;
    public versionSpec: string;
}