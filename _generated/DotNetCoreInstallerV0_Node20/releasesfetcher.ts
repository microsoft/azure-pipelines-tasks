import * as util from 'util';
import * as taskLib from 'azure-pipelines-task-lib/task';

import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { HttpClientResponse } from 'typed-rest-client/HttpClient';
import * as trm from 'azure-pipelines-task-lib/toolrunner';

import * as os from 'os';
import * as path from 'path';
import * as utils from "./utilities";

export class DotNetCoreReleaseFetcher {

    // OsSuffixes - The suffix which is a part of the file name ex- linux-x64, windows-x86
    // Type - SDK / Runtime
    // Version - Version of the SDK/Runtime
    public static async getDownloadUrls(osSuffixes: string[], version: string, type: string): Promise<string[]> {
        let downloadUrls = [];
        let releasesJSON = await this.getReleasesJson();

        let releasesInfo = JSON.parse(await releasesJSON.readBody());
        releasesInfo = releasesInfo.filter(releaseInfo => {
            return releaseInfo['version-' + type] === version || releaseInfo['version-' + type + '-display'] === version;
        });

        if (releasesInfo.length != 0) {
            let release = releasesInfo[0];
            let blobUrl: string = release['blob-' + type];
            let dlcUrl: string = release['dlc-' + type];
            let fileName: string = release[type + '-' + osSuffixes[0]] ? release[type + '-' + osSuffixes[0]] : release[type + '-' + osSuffixes[1]];

            if (!!fileName) {
                fileName = fileName.trim();
                // For some latest version, the filename itself can be full download url.
                // Do a very basic check for url(instead of regex) as the url is only for downloading and
                // is coming from .net core releases json and not some ransom user input
                if (fileName.toLowerCase().startsWith("https://")) {
                    downloadUrls.push(fileName);
                } else {
                    if (!!blobUrl) {
                        downloadUrls.push(util.format("%s%s", blobUrl.trim(), fileName));
                    }

                    if (!!dlcUrl) {
                        downloadUrls.push(util.format("%s%s", dlcUrl.trim(), fileName));
                    }
                }
            }
            else {
                throw taskLib.loc("VersionsFileMalformed", DotNetCoreReleasesUrl);
            }
        }
        else {
            console.log(taskLib.loc("WarningVersionNotFound", version));
            taskLib.warning(taskLib.loc('UpdateToNewerVersion', version));
            downloadUrls = this.getFallbackDownloadUrls(type, version);
        }

        if (downloadUrls.length == 0) {
            throw taskLib.loc("NullDownloadUrls", version);
        }

        return downloadUrls;
    }

    private static getReleasesJson(): Promise<HttpClientResponse> {
        let proxyUrl: string = taskLib.getVariable("agent.proxyurl");
        var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
            proxy: {
                proxyUrl: proxyUrl,
                proxyUsername: taskLib.getVariable("agent.proxyusername"),
                proxyPassword: taskLib.getVariable("agent.proxypassword"),
                proxyBypassHosts: taskLib.getVariable("agent.proxybypasslist") ? JSON.parse(taskLib.getVariable("agent.proxybypasslist")) : null
            }
        } : {};

        var httpCallbackClient = new httpClient.HttpClient(taskLib.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);
        return httpCallbackClient.get(DotNetCoreReleasesUrl);
    }

    private static getFallbackDownloadUrls(packageType: string, version: string): string[] {
        let scriptRunner: trm.ToolRunner;
        let primaryUrlSearchString: string;
        let legacyUrlSearchString: string;

        if (taskLib.osType().match(/^Win/)) {
            let escapedScript = path.join(utils.getCurrentDir(), 'externals', 'install-dotnet.ps1').replace(/'/g, "''");
            let command = `& '${escapedScript}' -Version ${version} -DryRun`
            if (packageType === 'runtime') {
                command = command.concat(" -SharedRuntime");
            }

            let powershellPath = taskLib.which('powershell', true);
            scriptRunner = taskLib.tool(powershellPath)
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);

            primaryUrlSearchString = "dotnet-install: Primary - ";
            legacyUrlSearchString = "dotnet-install: Legacy - ";
        } else {
            let escapedScript = path.join(utils.getCurrentDir(), 'externals', 'install-dotnet.sh').replace(/'/g, "''");
            utils.setFileAttribute(escapedScript, "755");
            scriptRunner = taskLib.tool(taskLib.which(escapedScript, true));
            scriptRunner.arg('--version');
            scriptRunner.arg(version);
            scriptRunner.arg('--dry-run');
            if (packageType === 'runtime') {
                scriptRunner.arg('--shared-runtime');
            }

            primaryUrlSearchString = "dotnet-install: Payload URL: ";
            legacyUrlSearchString = "dotnet-install: Legacy payload URL: ";
        }

        let result: trm.IExecSyncResult = scriptRunner.execSync();
        if (result.code != 0) {
            throw taskLib.loc("getDownloadUrlsFailed", result.error ? result.error.message : result.stderr);
        }

        let output: string = result.stdout;

        let primaryUrl: string = null;
        let legacyUrl: string = null;
        if (!!output && output.length > 0) {
            let lines: string[] = output.split(os.EOL);
            if (!!lines && lines.length > 0) {
                lines.forEach((line: string) => {
                    if (!line) { return; }
                    var primarySearchStringIndex = line.indexOf(primaryUrlSearchString);
                    if (primarySearchStringIndex > -1) {
                        primaryUrl = line.substring(primarySearchStringIndex + primaryUrlSearchString.length);
                        return;
                    }

                    var legacySearchStringIndex = line.indexOf(legacyUrlSearchString);
                    if (legacySearchStringIndex > -1) {
                        legacyUrl = line.substring(legacySearchStringIndex + legacyUrlSearchString.length);
                        return;
                    }
                });
            }
        }

        return [primaryUrl, legacyUrl];
    }
}

const DotNetCoreReleasesUrl: string = "https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/DotNetCoreInstallerV0/externals/releases.json";