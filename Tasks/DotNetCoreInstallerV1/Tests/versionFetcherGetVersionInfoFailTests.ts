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
                if (url == DotNetCoreReleasesIndexUrl &&  process.env["__failat__"] == "versionnotfound") {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases-index": [{"channel-version": "2.2","releases.json": "${ReleasesJsonUrl2}"}]}`))
                    });
                }
                else if (url == DotNetCoreReleasesIndexUrl && process.env["__failat__"] == "channelfetch") {
                    return new Promise((resolve, reject) => {
                        reject("");
                    });
                }
                else if (url == ReleasesJsonUrl2) {
                    return new Promise((resolve, reject) => {
                        resolve(new HttpClientResponse(`{"releases": [{"version": "2.2.104","files": ["rid":"winx64", "url": "https://dotnetWindowsDownloadUrl.com"]}]}`));
                    });
                }
            }
        }
    }
});

import { DotNetCoreVersionFetcher } from "../versionfetcher";

const DotNetCoreReleasesIndexUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases-index.json";
const ReleasesJsonUrl2: string = "https://releases.file.com/version2.2.json"

let versionFetcher = new DotNetCoreVersionFetcher();
versionFetcher.getVersionInfo("2.2.999-cantbefound-234", "sdk", false)
    .catch((ex) => {
        tl.setResult(tl.TaskResult.Failed, "FailedAsExpected");
    });