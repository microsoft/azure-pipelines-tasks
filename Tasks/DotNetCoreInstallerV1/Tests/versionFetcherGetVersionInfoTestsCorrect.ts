import * as tl from 'vsts-task-lib/task';
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
                if (url == DotNetCoreReleasesIndexUrl) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases-index": [{"channel-version": "2.0","releases.json": "${ReleasesJsonUrl0}"}, {"channel-version": "2.1","releases.json": "${ReleasesJsonUrl1}"}, {"channel-version": "2.2","releases.json": "${ReleasesJsonUrl2}"}, {"channel-version": "2.3","releases.json": "${ReleasesJsonUrl3}"}]}`))
                    });
                }
                else if (url == ReleasesJsonUrl0) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{
                            "releases": [
                                {
                                    "sdk": {
                                        "version": "2.0.1",
                                        "files": []
                                    }
                                },
                                {
                                    "sdk": {
                                        "version": "2.1.104",
                                        "files": []
                                    }
                                }
                            ]
                        }`));
                    });
                }
                else if (url == ReleasesJsonUrl1) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases": [{"sdk": { "version": "2.1.103-preview-999","files": [] } }]}`));
                    });
                }
                else if (url == ReleasesJsonUrl2) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases": [{"sdk": {"version": "2.2.106-preview-1","files": []}}, {"sdk": { "version": "2.2.105","files": []}}, {"sdk": { "version": "2.2.103","files": []}}]}`));
                    });
                }
                else if (url == ReleasesJsonUrl3) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases": [{"sdk": { "version": "2.3.105","files": []}}, {"sdk": { "version": "2.3.103-preview-999","files": [] } }]}`));
                    });
                }
            }
        }
    }
});

import { DotNetCoreVersionFetcher } from "../versionfetcher";

const DotNetCoreReleasesIndexUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases-index.json";
const ReleasesJsonUrl0: string = "https://releases.file.com/version2.0.json";
const ReleasesJsonUrl1: string = "https://releases.file.com/version2.1.json";
const ReleasesJsonUrl2: string = "https://releases.file.com/version2.2.json";
const ReleasesJsonUrl3: string = "https://releases.file.com/version2.3.json";

let versionFetcher = new DotNetCoreVersionFetcher();
versionFetcher.getVersionInfo(process.env["__versionspec__"], "sdk", process.env["__inlcudepreviewversion__"] == "true")
    .then((versionInfo) => {
        if (process.env["__versionspec__"] == "2.2.103" && versionInfo.getVersion() != "2.2.103") {
            throw "";
        }
        else if (process.env["__versionspec__"] == "2.1.104" && versionInfo.getVersion() != "2.1.104") {
            throw "";
        }
        else if (process.env["__versionspec__"] == "2.x" && versionInfo.getVersion() != "2.3.105" ) {
            throw "";
        }
        else if (process.env["__versionspec__"] == "2.2.x" && process.env["__inlcudepreviewversion__"] != "true" && versionInfo.getVersion() != "2.2.105") {
            throw "";
        }
        else if (process.env["__versionspec__"] == "2.2.x" && process.env["__inlcudepreviewversion__"] == "true" && versionInfo.getVersion() != "2.2.106-preview-1") {
            throw "";
        }
        else if (process.env["__versionspec__"] == "2.3.x" && process.env["__inlcudepreviewversion__"] == "true" && versionInfo.getVersion() != "2.3.105") {
            throw "";
        }

        tl.setResult(tl.TaskResult.Succeeded, "succeeded");
    })
    .catch((ex) => {
        tl.setResult(tl.TaskResult.Failed, "FailedAsExpected");
    });