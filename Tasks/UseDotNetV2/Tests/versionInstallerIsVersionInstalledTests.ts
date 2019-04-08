import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import { Constants } from "../versionutilities";
let mockery = require('mockery');

const version = "2.1.1";
const installationPath: string = "installationPath"

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

let sdkFolderExists = true;
let sdkFileExists = true;
let runtimeFolderExists = true;
let runtimeFileExists = true;
mockery.registerMock('vsts-task-lib/task', {
    exist: function (elementPath: string) {
        if (elementPath == path.join(installationPath, Constants.relativeSdkPath, version)) {
            return sdkFolderExists;
        }
        else if (elementPath == path.join(installationPath, Constants.relativeSdkPath, `${version}.complete`)) {
            return sdkFileExists;
        }
        else if (elementPath == path.join(installationPath, Constants.relativeRuntimePath, version)) {
            return runtimeFolderExists;
        }
        else if (elementPath == path.join(installationPath, Constants.relativeRuntimePath, `${version}.complete`)) {
            return runtimeFileExists;
        }
        else if (elementPath == installationPath) {
            return true;
        }

        return false;
    },
    loc: function (locString, ...param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    warning: function (message) { return tl.warning(message); },
    error: function (errorMessage) { return tl.error(errorMessage); },
    getVariable: function (variableName) { return tl.getVariable(variableName); },
    getHttpProxyConfiguration: function () { return ""; },
    setResourcePath: function (path) { return; }
});

import { VersionInstaller } from "../versioninstaller";
let versionInstaller = new VersionInstaller("sdk", installationPath);

if (process.env["__case__"] == "nonexplicit") {
    let throwcount = 0;
    try {
        versionInstaller.isVersionInstalled("")
    }
    catch (ex) {
        throwcount++
    }

    try {
        versionInstaller.isVersionInstalled("2.1")
    }
    catch (ex) {
        throwcount++
    }

    try {
        versionInstaller.isVersionInstalled("2.1.x")
    }
    catch (ex) {
        throwcount++
    }

    if (throwcount == 3) {
        tl.setResult(tl.TaskResult.Failed, "ThrewAsExpected");
    }
    else {
        tl.setResult(tl.TaskResult.Succeeded, "ShouldHaveThrownInAllCases");
    }
}
else if (process.env["__case__"] == "folderorfilemissing") {
    sdkFolderExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    sdkFolderExists = true;
    sdkFileExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    sdkFolderExists = false;
    sdkFileExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    versionInstaller = new VersionInstaller("runtime", installationPath);
    runtimeFolderExists = true;
    runtimeFileExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    runtimeFolderExists = true;
    runtimeFileExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    runtimeFolderExists = true;
    runtimeFileExists = false;
    if (versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedFalse");
        throw "";
    }

    tl.setResult(tl.TaskResult.Succeeded, "ReturnedFalseForAll");
}
else if (process.env["__case__"] == "success") {
    if (!versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedTrue");
        throw "";
    }

    versionInstaller = new VersionInstaller("runtime", installationPath);
    if (!versionInstaller.isVersionInstalled(version)) {
        tl.setResult(tl.TaskResult.Failed, "ShouldHaveReturnedTrue");
        throw "";
    }

    tl.setResult(tl.TaskResult.Succeeded, "ReturnedTrue");
}