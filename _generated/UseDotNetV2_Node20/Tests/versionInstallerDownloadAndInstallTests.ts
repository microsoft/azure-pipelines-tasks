"use strict";
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import { toolrunner } from './mocks/mockedModels'
import { Constants } from "../versionutilities";
import fs = require('fs');
var mockery = require('mockery');
var osType = "win";

const installationPath: string = "installationPath"

//setup mocks
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

mockery.registerMock('azure-pipelines-tool-lib/tool', {
    downloadTool: function (url: string, fileName?: string): Promise<string> {
        return Promise<string>((resolve, reject) => {
            if (process.env["__case__"] == "downloaderror") {
                reject("downloaderror");
            }

            resolve("downloadPath");
        });
    },
    extractZip: function (file: string): Promise<string> {
        return Promise<string>((resolve, reject) => {
            if (process.env["__case__"] == "extracterror") {
                reject("extractError");
            }

            resolve("extractPath");
        })
    },
    extractTar: function (file: string): Promise<string> {
        return Promise<string>((resolve, reject) => {
            if (process.env["__case__"] == "extracterror") {
                reject("extractError");
            }

            resolve("extractPath");
        })
    }
})

mockery.registerMock('azure-pipelines-task-lib/task', {
    exist: function (elementPath: string) {
        if (elementPath.startsWith(installationPath)) {
            return true;
        }

        return false;
    },
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
    ls: function (options: string, paths: string[]): string[] {
        if (paths.length == 1 && paths[0] == "extractPath") {
            return ["host", "sdk", "shared", "dotnet.exe", "ThirdPartyNotices.txt", "LICENSE"];
        }
        else if (paths.length == 1 && paths[0].includes(Constants.relativeSdkPath)) {
            return ["1.0.0", "1.0.0.complete", "2.0.0", "2.0.0.complete", "2.1.0", "2.1.0.complete", "nugetfallback"]
        }
        else if (paths.length == 1 && paths[0].includes(Constants.relativeRuntimePath)) {
            return ["1.0.0", "1.0.0.complete", "2.0.0", "2.0.0.complete", "2.1.0", "2.1.0.complete", ""]
        }

        return [];
    },
    cp: function (source: string, dest: string, options?: string, continueOnError?: boolean): void {
        if (source.indexOf(".") > -1 && process.env["__case__"] == "filecopyerror") {
            throw "fileCopyError";
        }

        return;
    },
    writeFile: function (file: string, data: string | Buffer, options?: string): void {
        if (process.env["__case__"] == "versioncompletefileerror") {
            throw "versioncompletefileerror";
        }

        tl.debug(tl.loc("creatingfile", file));
        return;
    },
    loc: function (locString, ...param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    warning: function (message) { return tl.warning(message); },
    error: function (errorMessage) { return tl.error(errorMessage); },
    getVariable: function (variableName) { return tl.getVariable(variableName); },
    getHttpProxyConfiguration: function () { return ""; },
    getHttpCertConfiguration: function () { return "" },
    setResourcePath: function (path) { return; }
});

mockery.registerMock('fs', {
    ...fs,
    lstatSync: function (path: string) {
        if (path.indexOf(".") > -1 && !path.endsWith("1.0.0") && !path.endsWith("2.0.0") && !path.endsWith("2.1.0")) {
            return {
                isDirectory: function () {
                    return false;
                }
            };
        }

        return {
            isDirectory: function () {
                return true;
            }
        };
    }
});

//start tests
import { VersionInstaller } from "../versioninstaller";
import { VersionInfo } from "../models";
import { Promise } from 'q';
let versionInstaller = new VersionInstaller("sdk", installationPath);

let versionInfo = new VersionInfo(JSON.parse(`{"version":"2.2.104", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": "https://path.to/file.tar.gz"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.tar.gz", "rid":"osx-x64", "url": "https://path.toMac/file.tar.gz"}, {"name": "win.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "win.zip", "rid":"win-x64", "url": "https://path.to/file.zip"}]}`), "sdk");
process.env["AGENT_TEMPDIRECTORY"] = process.cwd();

if (process.env["__case__"] == "urlerror") {
    versionInstaller.downloadAndInstall(versionInfo, "")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "DidNotThrowAsExpected");
        }, (ex) => {
            versionInstaller.downloadAndInstall(null, "https://path.to/file.zip")
                .then(() => {
                    tl.setResult(tl.TaskResult.Succeeded, "DidNotThrowAsExpected");
                }, (ex) => {
                    tl.setResult(tl.TaskResult.Failed, "ThrewAsExpected");
                });
        });
}
else if (process.env["__case__"] == "downloaderror") {
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "DidNotThrowAsExpected");
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "ThrewAsExpected");
        });
}
else if (process.env["__case__"] == "extracterror") {
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "DidNotThrowAsExpected");
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "ThrewAsExpected");
        });
}
else if (process.env["__case__"] == "filecopyerror") {
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "SuccessfullyCompleted");
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "TestThrewException");
        });
}
else if (process.env["__case__"] == "conditionalfilecopy") {
    // version being installed is the latest among already installed ones in the installation path and hence files should also be copied
    versionInfo = new VersionInfo(JSON.parse(`{"version":"2.2.104", "runtime-version":"2.0.100", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": "https://path.to/file.tar.gz"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.tar.gz", "rid":"osx-x64", "url": "https://path.toMac/file.tar.gz"}, {"name": "win.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "win.zip", "rid":"win-x64", "url": "https://path.to/file.zip"}]}`), "sdk");
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            // version being installed is not the latest and hence root directory files should not be copied.
            versionInfo = new VersionInfo(JSON.parse(`{"version":"2.0.1", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": "https://path.to/file.tar.gz"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.tar.gz", "rid":"osx-x64", "url": "https://path.toMac/file.tar.gz"}, {"name": "win.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "win.zip", "rid":"win-x64", "url": "https://path.to/file.zip"}]}`), "sdk");
            versionInstaller.downloadAndInstall(versionInfo, "file")
                .then(() => {
                    versionInstaller = new VersionInstaller("runtime", installationPath);

                    // version being installed is the latest but files will still no be copied as runtime is being installed.
                    versionInfo = new VersionInfo(JSON.parse(`{"version":"2.2.104", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": "https://path.to/file.tar.gz"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.tar.gz", "rid":"osx-x64", "url": "https://path.toMac/file.tar.gz"}, {"name": "win.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "win.zip", "rid":"win-x64", "url": "https://path.to/file.zip"}]}`), "runtime");
                    versionInstaller.downloadAndInstall(versionInfo, "file")
                        .then(() => {
                            tl.setResult(tl.TaskResult.Succeeded, "CopiedFilesConditionally");
                        }, (ex) => {
                            tl.setResult(tl.TaskResult.Failed, "ShouldNotHaveThrown");
                        })
                }, (ex) => {
                    tl.setResult(tl.TaskResult.Failed, "ShouldNotHaveThrown");
                });
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "ShouldNotHaveThrown");
        });
}
else if (process.env["__case__"] == "versioncompletefileerror") {
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "ShouldHaveThrown");
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "ThrewAsExpected");
        });

}
else if (process.env["__case__"] == "successfullinstall") {
    versionInstaller.downloadAndInstall(versionInfo, "file")
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, "SuccessfullyInstalled");
        }, (ex) => {
            tl.setResult(tl.TaskResult.Failed, "ShouldNotHaveThrownException" + ex);
        });
}
