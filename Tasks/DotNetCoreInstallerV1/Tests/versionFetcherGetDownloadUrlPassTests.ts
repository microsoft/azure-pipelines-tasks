import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import { toolrunner } from './mocks/mockedModels'
var mockery = require('mockery');
var osType = "win";

mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('typed-rest-client/HttpClient', {
    HttpClient: function () {
        return {
            get: function (url: string, headers) {
                return "";
            }
        }
    }
});

mockery.registerMock('vsts-task-lib/task', {
    osType: function () { return osType; },
    which: function (tool: string, check: boolean) {
        if (tool == 'powershell') {
            return "C:/Program Files/PowerShell";
        }
        else if (tool.endsWith(".sh")) {
            return "/temp/somefile.sh";
        }
    },
    tool: function (pathToTool) {
        if (osType.toLowerCase().includes("win")) {
            return new toolrunner(pathToTool, {
                code: 0,
                error: null,
                stderr: "",
                stdout: `Primary:win-x64${os.EOL}Legacy:win-x64`
            });
        }
        else if (osType.toLowerCase().includes("linux")) {
            return new toolrunner(pathToTool, {
                code: 0,
                error: null,
                stderr: "",
                stdout: `Primary:linux-x64${os.EOL}Legacy:ubuntu16.04`
            });
        }
        else if (osType.toLowerCase().includes("osx")) {
            return new toolrunner(pathToTool, {
                code: 0,
                error: null,
                stderr: "",
                stdout: `Primary:osx-x64${os.EOL}Legacy:osx-x64`
            });
        }
    },
    loc: function (locString, param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    error: function (errorMessage) { return tl.error(errorMessage); },
    getVariable: function (variableName) { return tl.getVariable(variableName); },
    getHttpProxyConfiguration: function () { return ""; },
    setResourcePath: function (path) { return; }
});


import { DotNetCoreVersionFetcher } from "../versionfetcher";
import { VersionInfo } from '../models';
let versionFetcher = new DotNetCoreVersionFetcher();
try {
    let versionInfo = new VersionInfo(JSON.parse(`{"version":"2.2.104", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": "https://path.to/file.tar.gz"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.tar.gz", "rid":"osx-x64", "url": "https://path.toMac/file.tar.gz"}, {"name": "win.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "win.zip", "rid":"win-x64", "url": "https://path.to/file.zip"}]}`), "sdk");

    // Test for windows
    osType = "win";
    let downloadUrl = versionFetcher.getDownloadUrl(versionInfo);
    if (downloadUrl != "https://path.to/file.zip") {
        throw "";
    }

    // Test for linux
    osType = "linux";
    downloadUrl = versionFetcher.getDownloadUrl(versionInfo);
    if (downloadUrl != "https://path.to/file.tar.gz") {
        throw "";
    }

    // Test for mac os
    osType = "osx";
    downloadUrl = versionFetcher.getDownloadUrl(versionInfo);
    if (downloadUrl != "https://path.toMac/file.tar.gz") {
        throw "";
    }

    tl.setResult(tl.TaskResult.Succeeded, "CorrectDownloadUrlsSuccessfullyReturnedForAllOs");
}
catch (ex) {
    tl.setResult(tl.TaskResult.Failed, "TestThrewException" + ex);
}