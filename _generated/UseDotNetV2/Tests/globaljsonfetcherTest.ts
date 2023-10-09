"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import { GlobalJson } from "../globaljsonfetcher";
import { Buffer } from "buffer";
import { VersionInfo } from '../models';
import { Promise } from 'q';
import fs = require('fs');
var mockery = require('mockery');

const workingDir: string = "work/";
const validRootGlobalJson = workingDir + "global.json";
const rootVersionNumber = "2.2.2";
const workingSubDir = workingDir + "testdir/";
const validSubDirGlobalJson = workingSubDir + "global.json";
const subDirVersionNumber = "3.0.0-pre285754637";
const pathToEmptyGlobalJsonDir = workingDir + "empty/";
const pathToEmptyGlobalJson = pathToEmptyGlobalJsonDir + "global.json";

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
        return [];
    },
    loc: function (locString, ...param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); }
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
        return Buffer.from(null);
    }
});

mockery.registerMock('./versionfetcher', {
    DotNetCoreVersionFetcher: function (explicitVersioning: boolean = false) {
        return {
            getVersionInfo: function (versionSpec: string, vsVersionSpec: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
                return Promise<VersionInfo>((resolve, reject) => {
                    resolve(new VersionInfo({ version: versionSpec, files: null, "runtime-version": versionSpec, "vs-version": vsVersionSpec }, packageType));
                });
            }
        }
    }

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