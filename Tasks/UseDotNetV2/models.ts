"use strict";
import * as semver from "semver";
import * as url from "url";

import * as tl from 'azure-pipelines-task-lib/task';

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
        this.packageType = packageType;
        this.files = [];
        versionInfoObject.files.forEach(fileData => {
            try {
                this.files.push(new VersionFilesData(fileData));
            }
            catch (ex) {
                tl.debug(tl.loc("FilesDataIsIncorrectInVersion", this.packageType, this.version, ex));
            }
        });

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

        if(!channelRelease["support-phase"])
        {
            tl.debug(tl.loc("SupportPhaseNotPresentInChannel", this.channelVersion));
        }
        else
        {
            this.supportPhase = channelRelease["support-phase"];
        }
    }

    public channelVersion: string;
    public releasesJsonUrl: string;
    public supportPhase: string;
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

    /**
     * Validate the version. Returns an exception if the version number is wrong.
     * @param version the input version number as string
     */
    private static ValidateVersionSpec(version: string): void {
        try {
            let parts = version.split('.');
            // validate version
            if (parts.length < 2 || // check if the version has at least 3 parts
                (parts[1] == "x" && parts.length > 2) ||  // a version number like `1.x` must have only major and minor version
                (parts[1] != "x" && parts.length <= 2) ||  // a version number like `1.1` must have a patch version
                !parts[0] || // The major version must always be set
                !parts[1] || // The minor version must always be set
                (parts.length == 3 && !parts[2]) || // a version number like `1.1.` is invalid because the patch version is missing
                Number.isNaN(Number.parseInt(parts[0])) || // the major version number must be a number
                (
                    parts[1] != "x" && // if the minor version is not `x`
                    (
                        Number.isNaN(Number.parseInt(parts[1])) || // the minor version number must be a number
                        (
                            parts.length > 2 && parts[2] != "x" && // if the patch is not `x`, then its an explicit version
                            !semver.valid(version) // validate the explicit version
                        )
                    )
                )
            ) {
                throw tl.loc("VersionNumberHasTheWrongFormat", version);
            }

            new semver.Range(version);
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