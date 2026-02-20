"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import * as fileSystem from "fs";
import * as JSON5 from 'json5';
import { VersionInfo } from "./models";
import { DotNetCoreVersionFetcher } from "./versionfetcher";
import { applyRollForwardPolicy, validRollForwardPolicies } from "./versionutilities";

export interface GlobalJsonVersion {
    version: string;
    rollForward?: string;
}

export class globalJsonFetcher {

    private workingDirectory: string;
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
        var versionInformation: VersionInfo[] = [] as VersionInfo[];
        var globalJsonVersions = this.getGlobalJsonVersions();
        let explicitFetcher = new DotNetCoreVersionFetcher(true);
        let nonExplicitFetcher = new DotNetCoreVersionFetcher(false);
        for (let index = 0; index < globalJsonVersions.length; index++) {
            const entry = globalJsonVersions[index];
            if (entry != null) {
                let channelSpec = entry.version;
                let matchingSpec: string | undefined;
                let versionFetcher = explicitFetcher;

                if (entry.rollForward) {
                    const resolvedSpec = applyRollForwardPolicy(entry.version, entry.rollForward);
                    if (resolvedSpec !== entry.version) {
                        versionFetcher = nonExplicitFetcher;
                        // Range specs (e.g., ">=8.0.100 <8.0.200" from patch/latestPatch)
                        // need a separate channel-compatible spec for VersionParts lookup
                        if (resolvedSpec.includes(' ')) {
                            const parts = entry.version.split('.');
                            channelSpec = `${parts[0]}.${parts[1]}.x`;
                            matchingSpec = resolvedSpec;
                        } else {
                            channelSpec = resolvedSpec;
                        }
                    }
                    tl.debug(tl.loc("ApplyingRollForwardPolicy", entry.rollForward, entry.version, matchingSpec || channelSpec));
                }

                var versionInfo = await versionFetcher.getVersionInfo(channelSpec, null, "sdk", false, matchingSpec);
                versionInformation.push(versionInfo);
            }
        }

        return Array.from(new Set(versionInformation)); // this remove all not unique values.
    }

    private getGlobalJsonVersions(): Array<GlobalJsonVersion | null> {
        let filePathsToGlobalJson = tl.findMatch(this.workingDirectory, "**/global.json");
        if (filePathsToGlobalJson == null || filePathsToGlobalJson.length == 0) {
            throw tl.loc("FailedToFindGlobalJson", this.workingDirectory);
        }

        return filePathsToGlobalJson.map(path => {
            var content = this.readGlobalJson(path);
            if (content != null) {
                tl.loc("GlobalJsonSdkVersion", content.sdk.version, path);
                return {
                    version: content.sdk.version,
                    rollForward: content.sdk.rollForward
                };
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
            // Since here is a buffer, we need to check length property to determine if it is empty.
            if (!fileContent.length) {
            // do not throw if globa.json is empty, task need not install any version in such case.
                tl.loc("GlobalJsonIsEmpty", path);
                return null;
            }

            globalJson = (JSON5.parse(fileContent.toString())) as GlobalJson;
        } catch (error) {
            // we throw if the global.json is invalid
            throw tl.loc("FailedToReadGlobalJson", path, error); // We don't throw if a global.json is invalid.
        }

        if (globalJson == null || globalJson.sdk == null || globalJson.sdk.version == null) {
            tl.loc("FailedToReadGlobalJson", path);
            return null;
        }

        if (globalJson.sdk.rollForward && !validRollForwardPolicies.includes(globalJson.sdk.rollForward)) {
            tl.warning(tl.loc("InvalidRollForwardPolicy", globalJson.sdk.rollForward, path));
            globalJson.sdk.rollForward = undefined;
        }

        return globalJson;
    }

}

export class GlobalJson {
    constructor(version: string | null = null, rollForward?: string) {
        if (version != null) {
            this.sdk = new sdk();
            this.sdk.version = version;
            this.sdk.rollForward = rollForward;
        }
    }
    public sdk: sdk;
}

class sdk {
    public version: string;
    public rollForward?: string;
}
