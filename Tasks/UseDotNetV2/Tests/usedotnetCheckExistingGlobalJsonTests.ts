"use strict";
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';
import { Constants } from '../versionutilities';
import { VersionInfo } from '../models';
import fs = require('fs');

let mockery = require('azure-pipelines-task-lib/lib-mocker');

// This test covers the scenario from issue #22039:
// When useGlobalJson=true and checkForExistingVersion=true with a rollForward policy,
// the task should check if an already-installed SDK version satisfies the version range
// instead of always resolving to the latest version and downloading it.
//
// For "latest*" policies (latestPatch, latestFeature, etc.), the task should still
// resolve to the actual latest and check for that exact version.

mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('fs', {
    ...fs,
    lstatSync: function (elementPath: string) {
        if (elementPath.indexOf(".") > -1 && !elementPath.endsWith("1.0.0") && !elementPath.endsWith("2.0.0") && !elementPath.endsWith("2.1.0")) {
            return {
                isDirectory: function () { return false; }
            };
        }
        return {
            isDirectory: function () { return true; }
        };
    }
});

// Mock dotnet CLI tool for listing installed SDKs
let mockDotnetListOutput = "";

function createMockToolRunner() {
    return {
        arg: function (_a: string) { return this; },
        execSync: function () {
            return {
                code: 0,
                stdout: mockDotnetListOutput,
                stderr: ""
            };
        }
    };
}

mockery.registerMock('azure-pipelines-task-lib/task', {
    getHttpProxyConfiguration: function () { return ""; },
    getHttpCertConfiguration: function () { return "" },
    setResourcePath: function (_resourcePath) { return; },
    prependPath: function (toolPath: string): void {
        if (toolPath.includes("installationPath") || toolPath.includes("agentstooldir")) {
            console.log(tl.loc("PrependingInstallationPath"));
            return;
        }
        if (toolPath.includes(Constants.relativeGlobalToolPath)) {
            console.log(tl.loc("PrependingGlobalToolPath"));
            return;
        }
    },
    osType: function () { return os.type(); },
    mkdirP: function (_directoryPath) { return; },
    loc: function (locString, ...param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    warning: function (message) { console.log("WARNING: " + message); },
    getVariable: function (variableName) {
        if (variableName == "Agent.ToolsDirectory") {
            return "agentstooldir";
        }
        return tl.getVariable(variableName);
    },
    getInput: function (inputName: string, _required: boolean): string {
        if (inputName == "packageType") {
            return "sdk";
        }
        else if (inputName == "version") {
            // When useGlobalJson is true, version may not be set
            if (process.env["__case__"]?.startsWith("globaljson")) {
                return "";
            }
            return "2.2.1";
        }
        else if (inputName == "installationPath") {
            return "installationPath";
        }
    },
    getBoolInput: function (inputName: string, required: boolean): boolean {
        if (inputName == "useGlobalJson") {
            if (process.env["__case__"]?.startsWith("globaljson")) {
                return true;
            }
            return false;
        }
        else if (inputName == "checkForExistingVersion") {
            return true; // Always true in these tests
        }
        else if (inputName == "includePreviewVersions") {
            if (required) { throw ""; }
            return false;
        }
        else if (inputName == "performMultiLevelLookup") {
            if (required) { throw ""; }
            return false;
        }
        return false;
    },
    getPathInput: function (inputName: string, _required: boolean): string {
        if (inputName == "workingDirectory") {
            return process.env["__workdir__"] || "";
        }
        return "";
    },
    setResult: function (result: tl.TaskResult, message: string): void {
        tl.setResult(result, message);
    },
    setVariable: function (name: string, value: string, secret?: boolean) {
        tl.setVariable(name, value, secret ? true : false);
    },
    which: function (_tool: string, _check: boolean): string {
        return "/usr/bin/dotnet";
    },
    tool: function (_toolPath: string) {
        return createMockToolRunner();
    },
    TaskResult: {
        Failed: tl.TaskResult.Failed,
        Succeeded: tl.TaskResult.Succeeded
    }
});

mockery.registerMock('./globaljsonfetcher', {
    globalJsonFetcher: function (_workingDirectory: string) {
        return {
            getGlobalJsonVersions: function () {
                if (process.env["__case__"] == "globaljson_existing_satisfies_patch") {
                    // global.json: { "sdk": { "version": "10.0.202", "rollForward": "patch" } }
                    return [{ version: "10.0.202", rollForward: "patch" }];
                }
                if (process.env["__case__"] == "globaljson_existing_not_satisfies") {
                    // global.json: { "sdk": { "version": "10.0.300", "rollForward": "patch" } }
                    return [{ version: "10.0.300", rollForward: "patch" }];
                }
                if (process.env["__case__"] == "globaljson_exact_version_installed") {
                    // global.json: { "sdk": { "version": "10.0.202" } } (no rollForward = disable)
                    return [{ version: "10.0.202" }];
                }
                if (process.env["__case__"] == "globaljson_exact_version_not_installed") {
                    // global.json: { "sdk": { "version": "10.0.999" } }
                    return [{ version: "10.0.999" }];
                }
                if (process.env["__case__"] == "globaljson_latestpatch_latest_installed") {
                    // global.json: { "sdk": { "version": "10.0.100", "rollForward": "latestPatch" } }
                    // GetVersions will resolve to 10.0.202 which IS installed
                    return [{ version: "10.0.100", rollForward: "latestPatch" }];
                }
                if (process.env["__case__"] == "globaljson_latestpatch_latest_not_installed") {
                    // global.json: { "sdk": { "version": "10.0.202", "rollForward": "latestPatch" } }
                    // GetVersions will resolve to 10.0.203 which is NOT installed
                    return [{ version: "10.0.202", rollForward: "latestPatch" }];
                }
                return [];
            },
            GetVersions: function () {
                // This is called for latest* policies - returns the resolved latest version
                if (process.env["__case__"] == "globaljson_latestpatch_latest_installed") {
                    // Resolved latest in the 10.0.1xx band is 10.0.202 (installed)
                    return new Promise<VersionInfo[]>((resolve, _reject) => {
                        resolve([new VersionInfo(JSON.parse(`{"version":"10.0.202", "runtime-version":"10.0.0", "files":[{"name":"linux-x64.tar.gz", "url":"https://example.com/sdk.tar.gz", "rid":"linux-x64"}]}`), "sdk")]);
                    });
                }
                // Default: resolved latest is 10.0.203 (not installed)
                return new Promise<VersionInfo[]>((resolve, _reject) => {
                    resolve([new VersionInfo(JSON.parse(`{"version":"10.0.203", "runtime-version":"10.0.0", "files":[{"name":"linux-x64.tar.gz", "url":"https://example.com/sdk.tar.gz", "rid":"linux-x64"}]}`), "sdk")]);
                });
            }
        };
    }
});

mockery.registerMock('./versionutilities', {
    ...require('../versionutilities'),
    Constants: Constants
});

mockery.registerMock('./versionfetcher', {
    DotNetCoreVersionFetcher: function () {
        return {
            getVersionInfo: function (_versionSpec: string, _vsVersionSpec: string, _packageType: string, _includePreviewVersions: boolean): Promise<VersionInfo> {
                return new Promise<VersionInfo>((resolve, _reject) => {
                    resolve(new VersionInfo(JSON.parse(`{"version":"10.0.203", "runtime-version":"10.0.0", "files":[{"name":"linux-x64.tar.gz", "url":"https://example.com/sdk.tar.gz", "rid":"linux-x64"}]}`), "sdk"));
                });
            },
            getDownloadUrl: function (versionInfo: VersionInfo): string {
                return versionInfo.getFiles()[0].url;
            }
        };
    }
});

mockery.registerMock('./versioninstaller', {
    VersionInstaller: function (_pacakageType: string, receivedInstallationPath: string) {
        console.log(tl.loc("installationPathValueIs", receivedInstallationPath));
        return {
            isVersionInstalled: function (_version: string): boolean {
                return false;
            },
            downloadAndInstall: function (_versionInfo: VersionInfo, _downloadUrl: string): Promise<void> {
                console.log(tl.loc("DownloadAndInstallCalled"));
                return new Promise<void>((resolve, _reject) => {
                    resolve();
                });
            }
        };
    }
});

mockery.registerMock('./nugetinstaller', {
    NuGetInstaller: {
        installNuGet: function (_version) {
            return new Promise<void>((resolve, _reject) => {
                resolve();
            });
        }
    }
});

process.env["USERPROFILE"] = "userprofile";
process.env.HOME = "home";

// Simulate installed SDKs: 10.0.202 is installed (matching the issue scenario)
mockDotnetListOutput = [
    "8.0.126 [/usr/share/dotnet/sdk]",
    "9.0.205 [/usr/share/dotnet/sdk]",
    "10.0.106 [/usr/share/dotnet/sdk]",
    "10.0.202 [/usr/share/dotnet/sdk]"
].join("\n");

require('../usedotnet');
