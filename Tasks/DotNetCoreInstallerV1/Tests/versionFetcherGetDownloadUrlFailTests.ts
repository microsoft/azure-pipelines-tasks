import * as tl from 'vsts-task-lib/task';
import * as os from 'os';
import { toolrunner } from './mocks/mockedModels'
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
                return "";
            }
        }
    }
});

mockery.registerMock('vsts-task-lib/task', {
    osType: function () { return process.env["__ostype__"]; },
    which: function (tool: string, check: boolean) {
        if (tool == 'powershell') {
            return "C:/Program Files/PowerShell";
        }
        else if (tool.endsWith(".sh")) {
            return "/temp/somefile.sh";
        }
    },
    tool: function (pathToTool) {
        if (process.env["__ostype__"].toLowerCase().includes("win")) {
            if (process.env["__getmachineosfail__"] == "true") {
                return new toolrunner(pathToTool, {code: 1, error: null, stderr: "failedWhileExecutingScript"});
            }

            return new toolrunner(pathToTool, {
                code: 0,
                error: null,
                stderr: "",
                stdout: `Primary:win-x64${os.EOL}Legacy:win-x64`
            });
        }
        else if (process.env["__ostype__"].toLowerCase().includes("linux")) {
            return new toolrunner(pathToTool, {
                code: 0,
                error: null,
                stderr: "",
                stdout: `Primary:linux-x64${os.EOL}Legacy:ubuntu16.04`
            });
        }
        else if (process.env["__ostype__"].toLowerCase().includes("osx")) {
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
    let versionInfo = new VersionInfo(JSON.parse(process.env["__versioninfo__"]), "sdk");
    let downloadUrl = versionFetcher.getDownloadUrl(versionInfo);
    if (downloadUrl) {
        tl.setResult(tl.TaskResult.Succeeded, "succeeded");
    }

    tl.setResult(tl.TaskResult.Failed, "DownloadUrlWasNotReturned");
}
catch (ex) {
    tl.setResult(tl.TaskResult.Failed, "TestThrewException" + ex);
}