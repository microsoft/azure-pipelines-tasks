"use strict";
import * as fileSystem from "fs";
import * as tl from 'azure-pipelines-task-lib/task';
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { VersionInfo } from "./models";

export class globalJsonFetcher {

    private workingDirectory: string;
    private versionFetcher: DotNetCoreVersionFetcher = new DotNetCoreVersionFetcher(true);
    /**
     * The global json fetcher provider functionality to extract the version information from all global json in the working directory.
     * @param workingDirectory
     */
    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;
    }

    /**
     * Get all version information from all global.json starting from the working directory without duplicates.
     */
    public async GetVersions(): Promise<VersionInfo[]> {
        var versionInformation: VersionInfo[] = new Array<VersionInfo>();
        var sdks = this.getSdks();
        for (let index = 0; index < sdks.length; index++) {
            const sdk = sdks[index];
            if (sdk != null) {
                var versionInfo = await this.versionFetcher.getVersionInfo(sdk.version, null, "sdk", sdk.allowPrerelease);
                versionInformation.push(versionInfo);
            }
        }

        return Array.from(new Set(versionInformation)); // this remove all not unique values.
    }

    private getSdks(): Array<sdk | null> {
        let filePathsToGlobalJson = tl.findMatch(this.workingDirectory, "**/global.json");
        if (filePathsToGlobalJson == null || filePathsToGlobalJson.length == 0) {
            throw tl.loc("FailedToFindGlobalJson", this.workingDirectory);
        }

        return filePathsToGlobalJson.map(path => {
            var content = this.readGlobalJson(path);
            if (content != null) {
                tl.loc("GlobalJsonSdkVersion", content.sdk.version, path);
                return content.sdk;
            }

            return null;
        })
            .filter(d => d != null); // remove all global.json that can't read
    }

    private readGlobalJson(path: string): GlobalJson | null {
        let globalJson: GlobalJson | null = null;
        tl.loc("GlobalJsonFound", path);
        try {
            let fileContent = fileSystem.readFileSync(path);
            if (!fileContent) {
            // do not throw if globa.json is empty, task need not install any version in such case.
                tl.loc("GlobalJsonIsEmpty", path);
                return null;
            }

            globalJson = (JSON.parse(fileContent.toString())) as { sdk: { version: string, allowPrerelease: boolean } };
        } catch (error) {
            // we throw if the global.json is invalid
            throw tl.loc("FailedToReadGlobalJson", path, error); // We don't throw if a global.json is invalid.
        }

        if (globalJson == null || globalJson.sdk == null || globalJson.sdk.version == null) {
            tl.loc("FailedToReadGlobalJson", path);
            return null;
        }

        return globalJson;
    }

}

export class GlobalJson {
    constructor(version: string | null = null, allowPrerelease: boolean | null = null) {
        if (version != null) {
            this.sdk = new sdk();
            this.sdk.version = version;
            if (allowPrerelease !== null) {
                this.sdk.allowPrerelease = allowPrerelease;
            } else {
                this.sdk.allowPrerelease = false;
            }
        }
    }
    public sdk: sdk;
}

class sdk {
    public version: string;
    public allowPrerelease: boolean;
}