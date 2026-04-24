"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import { Buffer } from "buffer";
import { Promise } from 'q';
import { GlobalJson } from "../globaljsonfetcher";
import { VersionInfo } from '../models';

import fs = require('fs');
var mockery = require('azure-pipelines-task-lib/lib-mocker');

const workingDir: string = "work/";
const validRootGlobalJson = workingDir + "global.json";
const rootVersionNumber = "2.2.2";
const workingSubDir = workingDir + "testdir/";
const validSubDirGlobalJson = workingSubDir + "global.json";
const subDirVersionNumber = "3.0.0-pre285754637";
const pathToEmptyGlobalJsonDir = workingDir + "empty/";
const pathToEmptyGlobalJson = pathToEmptyGlobalJsonDir + "global.json";
const pathToGlobalJsonWithCommentsDir = workingDir + "comments/";
const pathToGlobalJsonWithComments = pathToGlobalJsonWithCommentsDir + "global.json";
const pathToRollForwardDir = workingDir + "rollforward/";
const pathToRollForwardGlobalJson = pathToRollForwardDir + "global.json";
const rollForwardVersionNumber = "8.0.100";
const pathToRollForwardLatestPatchDir = workingDir + "rollforward-latestpatch/";
const pathToRollForwardLatestPatchGlobalJson = pathToRollForwardLatestPatchDir + "global.json";
const pathToInvalidRollForwardDir = workingDir + "invalidrollforward/";
const pathToInvalidRollForwardGlobalJson = pathToInvalidRollForwardDir + "global.json";
const pathToRollForwardPatchDir = workingDir + "rollforward-patch/";
const pathToRollForwardPatchGlobalJson = pathToRollForwardPatchDir + "global.json";
const pathToRollForwardPatchMissingDir = workingDir + "rollforward-patch-missing/";
const pathToRollForwardPatchMissingGlobalJson = pathToRollForwardPatchMissingDir + "global.json";
const patchVersionNumber = "10.0.202";
const patchMissingVersionNumber = "10.0.999";

//setup mocks
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('azure-pipelines-task-lib/task', {
    findMatch: function (path: string, searchPattern: string): string[] {
        if (searchPattern != "**/global.json") {
            return [];
        }
        if (path == workingDir) {
            // If it's working dir subdir is included, because it is a child;
            return [validRootGlobalJson, validSubDirGlobalJson];
        }
        if (path == workingSubDir) {
            return [validSubDirGlobalJson];
        }
        if (path == pathToEmptyGlobalJsonDir) {
            return [pathToEmptyGlobalJson];
        }
        if (path == pathToGlobalJsonWithCommentsDir) {
            return [pathToGlobalJsonWithComments];
        }
        if (path == pathToRollForwardDir) {
            return [pathToRollForwardGlobalJson];
        }
        if (path == pathToRollForwardLatestPatchDir) {
            return [pathToRollForwardLatestPatchGlobalJson];
        }
        if (path == pathToInvalidRollForwardDir) {
            return [pathToInvalidRollForwardGlobalJson];
        }
        if (path == pathToRollForwardPatchDir) {
            return [pathToRollForwardPatchGlobalJson];
        }
        if (path == pathToRollForwardPatchMissingDir) {
            return [pathToRollForwardPatchMissingGlobalJson];
        }
        return [];
    },
    loc: function (locString, ...param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    warning: function (message) { console.log("WARNING: " + message); }
});

mockery.registerMock('fs', {
    ...fs,
    readFileSync: function (path: string): Buffer {
        if (path == validRootGlobalJson) {
            var globalJson = new GlobalJson(rootVersionNumber);
            return Buffer.from(JSON.stringify(globalJson));
        }
        if (path == validSubDirGlobalJson) {
            var globalJson = new GlobalJson(subDirVersionNumber);
            return Buffer.from(JSON.stringify(globalJson));
        }
        if (path == pathToEmptyGlobalJson) {
            return Buffer.from("");
        }
        if (path == pathToGlobalJsonWithComments) {
            return Buffer.from(`{
                /*
                  This is a mult-line comment
                */
                "sdk": {
                    // This is a single-line comment
                    "version": "${rootVersionNumber}"
                }
            }`);
        }
        if (path == pathToRollForwardGlobalJson) {
            return Buffer.from(JSON.stringify({
                sdk: {
                    version: rollForwardVersionNumber,
                    rollForward: "latestFeature"
                }
            }));
        }
        if (path == pathToRollForwardLatestPatchGlobalJson) {
            return Buffer.from(JSON.stringify({
                sdk: {
                    version: rollForwardVersionNumber,
                    rollForward: "latestPatch"
                }
            }));
        }
        if (path == pathToInvalidRollForwardGlobalJson) {
            return Buffer.from(JSON.stringify({
                sdk: {
                    version: rollForwardVersionNumber,
                    rollForward: "invalidPolicy"
                }
            }));
        }
        if (path == pathToRollForwardPatchGlobalJson) {
            return Buffer.from(JSON.stringify({
                sdk: {
                    version: patchVersionNumber,
                    rollForward: "patch"
                }
            }));
        }
        if (path == pathToRollForwardPatchMissingGlobalJson) {
            return Buffer.from(JSON.stringify({
                sdk: {
                    version: patchMissingVersionNumber,
                    rollForward: "patch"
                }
            }));
        }
        return Buffer.from(null);
    }
});

mockery.registerMock('./versionfetcher', {
    DotNetCoreVersionFetcher: function (explicitVersioning: boolean = false) {
        return {
            getVersionInfo: function (versionSpec: string, vsVersionSpec: string, packageType: string, includePreviewVersions: boolean, matchingVersionSpec?: string): Promise<VersionInfo> {
                // For non-latest rollForward tests: when the explicit fetcher requests
                // a version that doesn't exist, throw to simulate "not found"
                if (explicitVersioning && versionSpec === patchMissingVersionNumber) {
                    throw new Error("Version not found: " + versionSpec);
                }
                const resultVersion = matchingVersionSpec || versionSpec;
                return Promise<VersionInfo>((resolve, reject) => {
                    resolve(new VersionInfo({
                        version: resultVersion,
                        files: [{
                            name: 'testfile.json',
                            hash: 'testhash',
                            url: 'testurl',
                            rid: 'testrid'
                        }],
                        "runtime-version": resultVersion,
                        "vs-version": vsVersionSpec
                    }, packageType));
                });
            }
        }
    }

});

mockery.registerMock("./versionutilities", {
    validRollForwardPolicies: [
        "patch", "feature", "minor", "major",
        "latestPatch", "latestFeature", "latestMinor", "latestMajor", "disable",
    ],
    applyRollForwardPolicy: function (version: string, rollForward: string): string {
        // Predetermined return values for known test inputs instead of reimplementing logic
        if (version === rollForwardVersionNumber) { // "8.0.100"
            switch (rollForward) {
                case "latestFeature": return "8.0.x";
                case "latestPatch": return ">=8.0.100 <8.0.200";
                default: return version;
            }
        }
        if (version === patchVersionNumber) { // "10.0.202"
            switch (rollForward) {
                case "patch": return ">=10.0.200 <10.0.300";
                default: return version;
            }
        }
        if (version === patchMissingVersionNumber) { // "10.0.999"
            switch (rollForward) {
                case "patch": return ">=10.0.900 <10.1.0";
                default: return version;
            }
        }
        return version;
    },
});

// start test
import { globalJsonFetcher } from "../globaljsonfetcher";

if (process.env["__case__"] == "subdirAsRoot") {
    let fetcher = new globalJsonFetcher(workingSubDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos.length != 1) {
            throw "GetVersions should return one result if one global.json is found.";
        }
        if (versionInfos[0].getVersion() != subDirVersionNumber) {
            throw `GetVersions should return the version number that was inside the global.json. Expected: ${subDirVersionNumber} Actual: ${versionInfos[0].getVersion()}`;
        }
        if (versionInfos[0].getPackageType() != 'sdk') {
            throw `GetVersions return always 'sdk' as package type. Actual: ${versionInfos[0].getPackageType()}`;
        }
    });
}

if (process.env["__case__"] == "rootAsRoot") {
    let fetcher = new globalJsonFetcher(workingDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos.length != 2) {
            throw "GetVersions should return all global.json in a folder hierarchy result if multiple global.json are found.";
        }
    });
}

if (process.env["__case__"] == "invalidDir") {
    let fetcher = new globalJsonFetcher("invalidDir");
    fetcher.GetVersions().then(versionInfos => {
        throw "GetVersions shouldn't success if no matching version was found.";
    }, err => {
        // here we are good because the getVersion throw an error.
        return;
    });
}

if (process.env["__case__"] == "emptyGlobalJson") {
    let fetcher = new globalJsonFetcher(pathToEmptyGlobalJsonDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null) {
            throw "GetVersions shouldn't return null if the global.json is empty.";
        }
        if (versionInfos.length != 0) {
            throw "GetVersions shouldn't return a arry with 0 elements if global.json is empty.";
        }
    }, err => {
        throw "GetVersions shouldn't throw an error if global.json is empty.";
    });
}

if (process.env["__case__"] == "globalJsonWithComments") {
    let fetcher = new globalJsonFetcher(pathToGlobalJsonWithCommentsDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null) {
            throw "GetVersions shouldn't return null if the global.json has comments.";
        }
        if (versionInfos.length != 1) {
            throw "GetVersions shouldn't return a arry with 0 elements if global.json has comments.";
        }
    }, err => {
        throw "GetVersions shouldn't throw an error if global.json has comments.";
    });
}

if (process.env["__case__"] == "rollForwardLatestFeature") {
    let fetcher = new globalJsonFetcher(pathToRollForwardDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null || versionInfos.length != 1) {
            throw "GetVersions should return one result for global.json with rollForward.";
        }
        // With latestFeature, the version spec passed to the fetcher should be major.minor.x (e.g. "8.0.x")
        // Since our mock fetcher returns versionSpec as the version, the resolved version should be "8.0.x"
        if (versionInfos[0].getVersion() != "8.0.x") {
            throw `Expected version spec '8.0.x' for latestFeature rollForward, but got '${versionInfos[0].getVersion()}'`;
        }
    }, err => {
        throw "GetVersions shouldn't throw for valid rollForward policy: " + err;
    });
}

if (process.env["__case__"] == "rollForwardLatestPatch") {
    let fetcher = new globalJsonFetcher(pathToRollForwardLatestPatchDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null || versionInfos.length != 1) {
            throw "GetVersions should return one result for global.json with rollForward latestPatch.";
        }
        // With latestPatch for version 8.0.100, the version spec should be ">=8.0.100 <8.0.200"
        if (versionInfos[0].getVersion() != ">=8.0.100 <8.0.200") {
            throw `Expected version spec '>=8.0.100 <8.0.200' for latestPatch rollForward, but got '${versionInfos[0].getVersion()}'`;
        }
    }, err => {
        throw "GetVersions shouldn't throw for valid rollForward policy: " + err;
    });
}

if (process.env["__case__"] == "invalidRollForward") {
    let fetcher = new globalJsonFetcher(pathToInvalidRollForwardDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null || versionInfos.length != 1) {
            throw "GetVersions should return one result even with invalid rollForward (it should be ignored).";
        }
        // Invalid rollForward should be ignored, so exact version should be passed
        if (versionInfos[0].getVersion() != rollForwardVersionNumber) {
            throw `Expected exact version '${rollForwardVersionNumber}' when rollForward is invalid, but got '${versionInfos[0].getVersion()}'`;
        }
    }, err => {
        throw "GetVersions shouldn't throw for invalid rollForward policy (should warn and ignore): " + err;
    });
}

if (process.env["__case__"] == "rollForwardPatchExactFound") {
    let fetcher = new globalJsonFetcher(pathToRollForwardPatchDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null || versionInfos.length != 1) {
            throw "GetVersions should return one result for global.json with rollForward patch.";
        }
        // With non-latest policy 'patch' and version 10.0.202 available in releases,
        // GetVersions should return the exact specified version, not the latest in the range.
        if (versionInfos[0].getVersion() != patchVersionNumber) {
            throw `Expected exact version '${patchVersionNumber}' for patch rollForward (exact found), but got '${versionInfos[0].getVersion()}'`;
        }
    }, err => {
        throw "GetVersions shouldn't throw for valid rollForward policy: " + err;
    });
}

if (process.env["__case__"] == "rollForwardPatchExactMissing") {
    let fetcher = new globalJsonFetcher(pathToRollForwardPatchMissingDir);
    fetcher.GetVersions().then(versionInfos => {
        if (versionInfos == null || versionInfos.length != 1) {
            throw "GetVersions should return one result for global.json with rollForward patch (fallback).";
        }
        // With non-latest policy 'patch' and version 10.0.999 NOT in releases,
        // GetVersions should fall back to range-based resolution (>=10.0.900 <10.1.0)
        // The mock returns the matchingVersionSpec as the version, so we expect the range.
        if (versionInfos[0].getVersion() != ">=10.0.900 <10.1.0") {
            throw `Expected range-based fallback '>=10.0.900 <10.1.0' for patch rollForward (exact missing), but got '${versionInfos[0].getVersion()}'`;
        }
    }, err => {
        throw "GetVersions shouldn't throw for valid rollForward policy with fallback: " + err;
    });
}
