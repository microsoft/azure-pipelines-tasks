import * as semver from "semver";
import * as url from "url";

import * as tl from 'vsts-task-lib/task';

import * as utils from "./versionutilities";

export class VersionInfo {
    private version: string;
    private files: VersionFilesData[];
    private packageType: string;
    private runtimeVersion: string;

    constructor(versionInfoObject: any, packageType: string) {
        if (!versionInfoObject.version || !versionInfoObject.files) {
            throw tl.loc("InvalidVersionObject", packageType, versionInfoObject)
        }

        this.version = versionInfoObject.version;
        this.files = [];
        versionInfoObject.files.forEach(fileData => {
            try {
                this.files.push(new VersionFilesData(fileData));
            }
            catch (ex) {
                tl.debug(tl.loc("FilesDataIsIncorrectInVersion", this.packageType, this.version, ex));
            }
        });

        this.packageType = packageType;
        if (this.packageType == utils.Constants.sdk) {
            this.runtimeVersion = versionInfoObject["runtime-version"] || "";
        }
        else {
            this.runtimeVersion = this.version;
        }
    }

    public getVersion(): string {
        return this.version;
    }

    public getFiles(): VersionFilesData[] {
        return this.files;
    }

    public getRuntimeVersion(): string {
        return this.runtimeVersion;
    }

    public getPackageType(): string {
        return this.packageType;
    }
}

export class VersionFilesData {
    public name: string;
    public url: string;
    public rid: string;
    public hash?: string;

    constructor(versionFilesData: any) {
        if(!versionFilesData || !versionFilesData.name || !versionFilesData.url || !versionFilesData.rid) {
            throw tl.loc("VersionFilesDataIncorrect");
        }

        this.name = versionFilesData.name;
        this.url = versionFilesData.url;
        this.rid = versionFilesData.rid;
        this.hash = versionFilesData.hash;
    }
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