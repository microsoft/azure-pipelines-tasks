"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import { HttpClientResponse } from "./mocks/mockedModels"
var mockery = require('mockery');

mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('typed-rest-client/HttpClient', {
    HttpClient: function () {
        return {
            get: function (url: string, headers) {
                if (url == DotNetCoreReleasesIndexUrl && process.env["__failat__"] == "versionnotfound") {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases-index": [
                                {
                                    "channel-version": "2.2",
                                    "releases.json": "${ReleasesJsonUrl2}"
                                },
                                {
                                    "channel-version": "3.0",
                                    "releases.json": "${ReleasesJsonUrl3}",
                                    "support-phase": "preview"
                                },
                                {
                                    "channel-version": "4.0",
                                    "releases.json": "${ReleasesJsonUrl4}"
                                },
                                {
                                    "channel-version": "4.1",
                                    "releases.json": "${ReleasesJsonUrl5}",
                                    "support-phase": "preview"
                                }
                            ]
                        }`))
                    });
                }
                else if (url == DotNetCoreReleasesIndexUrl && process.env["__failat__"] == "channelfetch") {
                    return new Promise((resolve, reject) => {
                        reject("");
                    });
                }
                else if (url == ReleasesJsonUrl2) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases": [
                                {
                                    "version": "2.2.104",
                                    "files": [
                                        "rid": "winx64",
                                        "url": "https://dotnetWindowsDownloadUrl.com"
                                    ]
                                }
                            ]
                        }`));
                    });
                }
                else if (url == ReleasesJsonUrl3) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases": [
                                {
                                    "version": "3.0.104",
                                    "files": [
                                        "rid": "winx64",
                                        "url": "https://dotnetWindowsDownloadUrl.com"
                                    ]
                                }
                            ]
                        }`));
                    });
                }
                else if (url == ReleasesJsonUrl4) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases": [
                                {
                                    "version": "4.0.102",
                                    "files": [
                                        "rid": "winx64",
                                        "url": "https://dotnetWindowsDownloadUrl.com"
                                    ]
                                }
                            ]
                        }`));
                    });
                }
                else if (url == ReleasesJsonUrl5) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases": [
                                {
                                    "version": "4.1.100",
                                    "files": [
                                        "rid": "winx64",
                                        "url": "https://dotnetWindowsDownloadUrl.com"
                                    ]
                                }
                            ]
                        }`));
                    });
                }
            }
        }
    }
});

import { DotNetCoreVersionFetcher } from "../versionfetcher";

const DotNetCoreReleasesIndexUrl: string = "https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json";
const ReleasesJsonUrl2: string = "https://releases.file.com/version2.2.json"
const ReleasesJsonUrl3: string = "https://releases.file.com/version3.0.json"
const ReleasesJsonUrl4: string = "https://releases.file.com/version4.0.json"
const ReleasesJsonUrl5: string = "https://releases.file.com/version4.1.json"

let versionFetcher = new DotNetCoreVersionFetcher();
versionFetcher.getVersionInfo(process.env["__versionspec__"], null, "sdk", process.env["__inlcudepreviewversion__"] == "true")
    .catch((ex) => {
        if (process.env["__versionspec__"] == "2.2.999-cantbefound-234") {
            tl.setResult(tl.TaskResult.Failed, "FailedAsExpected");
        }
        else if (process.env["__versionspec__"] == "3.x" && process.env["__inlcudepreviewversion__"] != "true") {
            tl.setResult(tl.TaskResult.Failed, "FailedAsExpected");
        }
        else if (process.env["__versionspec__"] == "4.40.x" && process.env["__inlcudepreviewversion__"] == "true") {
            tl.setResult(tl.TaskResult.Failed, "FailedAsExpected");
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, "succeeded");
        }
    });