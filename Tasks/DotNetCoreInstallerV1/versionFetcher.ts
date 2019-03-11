import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import * as tl from 'vsts-task-lib/task';
import * as trm from 'vsts-task-lib/toolrunner';

import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { HttpClientResponse } from 'typed-rest-client/HttpClient';

import * as utils from "./versionUtilities";

export class DotNetCoreVersionFetcher {
    constructor() {
        let proxyUrl: string = tl.getVariable("agent.proxyurl");
        var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
            proxy: {
                proxyUrl: proxyUrl,
                proxyUsername: tl.getVariable("agent.proxyusername"),
                proxyPassword: tl.getVariable("agent.proxypassword"),
                proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
            }
        } : {};

        this.httpCallbackClient = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);
    }

    public async getVersionInfo(version: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        var requiredVersion: VersionInfo = null;
        if (this.releasesIndex == null) {
            await this.setReleasesIndex();
        }

        let channelInformation: any = this.getVersionChannel(version);
        if (channelInformation) {
            requiredVersion = await this.getVersionFromChannel(channelInformation, version, packageType, includePreviewVersions);
        }

        if (!requiredVersion && !version.endsWith("x")) {
            console.log("FallingBackToAdjacentChannels", version);
            requiredVersion = await this.getVersionFromOtherChannels(version, packageType, includePreviewVersions);
        }

        if (!requiredVersion) {
            throw tl.loc("VersionNotFound", version);
        }

        let dotNetSdkVersionTelemetry = `{"userVersion":"${version}", "resolvedVersion":"${requiredVersion.version}"}`;
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=DotNetCoreInstallerV1]" + dotNetSdkVersionTelemetry);
        return requiredVersion;
    }

    public getDownloadUrl(versionInfo: VersionInfo, packageType: string): string {
        console.log(tl.loc("GettingDownloadUrl", packageType, versionInfo.version));

        let osSuffixes = this.detectMachineOS();
        let downloadPackageInfoObject: VersionFilesData = null;
        osSuffixes.find((osSuffix) => {
            downloadPackageInfoObject = versionInfo.files.find((downloadPackageInfo: any) => {
                if (downloadPackageInfo.rid.toLowerCase() == osSuffix.toLowerCase()) {
                    if (osSuffix.split("-")[0] != "win" || (osSuffix.split("-")[0] == "win" && downloadPackageInfo.name.endsWith(".zip"))) {
                        return true;
                    }
                }

                return false;
            });

            if (downloadPackageInfoObject) {
                return true;
            }

            return false;
        });

        if (!!downloadPackageInfoObject && downloadPackageInfoObject.url) {
            tl.debug("Got download URL for platform with rid: " + downloadPackageInfoObject.rid);
            return downloadPackageInfoObject.url;
        }

        return "";
    }

    private setReleasesIndex(): Promise<void> {
        return this.httpCallbackClient.get(DotNetCoreReleasesIndexUrl)
            .then((response: HttpClientResponse) => {
                return response.readBody();
            })
            .then((body: string) => {
                this.releasesIndex = JSON.parse(body);
                return;
            })
            .catch((ex) => {
                throw tl.loc("ExceptionWhileDownloadOrReadReleasesIndex", ex);
            });
    }

    private getVersionChannel(version: string): any {
        let versionParts: any = new utils.VersionParts(version);

        let channelVersion = `${versionParts.majorVersion}.${versionParts.minorVersion}`;
        if (versionParts.minorVersion == "x") {
            var latestChannelVersion: string = `${versionParts.majorVersion}.0`;
            this.releasesIndex["releases-index"].forEach(channel => {
                if (utils.versionCompareFunction(channel["channel-version"], latestChannelVersion) > 0) {
                    latestChannelVersion = channel["channel-version"];
                }
            });

            channelVersion = latestChannelVersion;
        }

        return this.releasesIndex["releases-index"].find(element => {
            if (element["channel-version"] == channelVersion) {
                return true
            }
        });
    }

    private getVersionFromChannel(channelInformation: any, version: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        let versionParts: utils.VersionParts = new utils.VersionParts(version);
        var releasesJsonUrl: string = channelInformation["releases.json"];
        var channelReleases: any = null;

        if (releasesJsonUrl) {
            return this.httpCallbackClient.get(releasesJsonUrl)
                .then((response: HttpClientResponse) => {
                    return response.readBody();
                })
                .then((body: string) => {
                    channelReleases = JSON.parse(body).releases;
                    if (versionParts.minorVersion == "x" || versionParts.patchVersion == "x") {

                        let latestVersion = "0.0.0";
                        channelReleases.forEach(release => {
                            if (release[packageType] && utils.versionCompareFunction(release[packageType].version, latestVersion) > 0 && (includePreviewVersions || !release[packageType].version.includes('preview'))) {
                                let matchedVersionParts = new utils.VersionParts(release[packageType].version);
                                if (matchedVersionParts.majorVersion == versionParts.majorVersion && (versionParts.minorVersion == "x" || (versionParts.patchVersion == "x" && matchedVersionParts.minorVersion == versionParts.minorVersion))) {
                                    latestVersion = release[packageType].version;
                                }
                            }
                        });

                        if (latestVersion == "0.0.0") {
                            throw tl.loc("MatchingVersionNotFound", version);
                        }

                        console.log(tl.loc("MatchingVersionForUserInputVersion", version, latestVersion));
                        version = latestVersion;
                    }

                    var versionRelease = channelReleases.find(release => {
                        if (release[packageType] && release[packageType].version == version) {
                            return true;
                        }

                        return false;
                    });

                    return versionRelease ? versionRelease[packageType] : null;
                });
        }
        else {
            throw tl.loc("UrlForReleaseChannelNotFound");
        }
    }

    private async getVersionFromOtherChannels(version: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        let fallbackChannels = this.getChannelsForMajorVersion(version);
        if (!fallbackChannels && fallbackChannels.length < 1) {
            throw tl.loc("NoSuitableChannelWereFound", version);
        }

        var versionInfo: VersionInfo = null;
        for (var i = 0; i < fallbackChannels.length; i++) {
            console.log("LookingForVersionInChannel", (fallbackChannels[i])["channel-version"]);
            versionInfo = await this.getVersionFromChannel(fallbackChannels[i], version, packageType, includePreviewVersions);

            if (versionInfo) {
                break;
            }
        }

        return versionInfo;
    }

    private getChannelsForMajorVersion(version: string): any {
        var versionParts = new utils.VersionParts(version);
        let adjacentChannels = [];
        this.releasesIndex["releases-index"].forEach(channel => {
            if (channel["channel-version"].startsWith(`${versionParts.majorVersion}`)) {
                adjacentChannels.push(channel);
            }
        });

        return adjacentChannels;
    }

    private detectMachineOS(): string[] {
        let osSuffix = [];
        let scriptRunner: trm.ToolRunner;

        try {
            console.log(tl.loc("DetectingPlatform"));
            if (tl.osType().match(/^Win/)) {
                let escapedScript = path.join(this.getCurrentDir(), 'externals', 'get-os-platform.ps1').replace(/'/g, "''");
                let command = `& '${escapedScript}'`

                let powershellPath = tl.which('powershell', true);
                scriptRunner = tl.tool(powershellPath)
                    .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                    .arg(command);
            }
            else {
                let scriptPath = path.join(this.getCurrentDir(), 'externals', 'get-os-distro.sh');
                this.setFileAttribute(scriptPath, "777");

                scriptRunner = tl.tool(tl.which(scriptPath, true));
            }

            let result: trm.IExecSyncResult = scriptRunner.execSync();

            if (result.code != 0) {
                throw tl.loc("getMachinePlatformFailed", result.error ? result.error.message : result.stderr);
            }

            let output: string = result.stdout;

            let index;
            if ((index = output.indexOf("Primary:")) >= 0) {
                let primary = output.substr(index + "Primary:".length).split(os.EOL)[0];
                osSuffix.push(primary);
                console.log(tl.loc("PrimaryPlatform", primary));
            }

            if ((index = output.indexOf("Legacy:")) >= 0) {
                let legacy = output.substr(index + "Legacy:".length).split(os.EOL)[0];
                osSuffix.push(legacy);
                console.log(tl.loc("LegacyPlatform", legacy));
            }

            if (osSuffix.length == 0) {
                throw tl.loc("CouldNotDetectPlatform");
            }
        }
        catch (ex) {
            throw tl.loc("FailedInDetectingMachineArch", ex)
        }

        return osSuffix;
    }

    private setFileAttribute(file: string, mode: string): void {
        fs.chmodSync(file, mode);
    }

    private getCurrentDir(): string {
        return __dirname;
    }

    private releasesIndex: any;
    private httpCallbackClient: httpClient.HttpClient;
}

export class VersionInfo {
    public version: string;
    public files: VersionFilesData[];

    public static getRuntimeVersion(versionInfo: VersionInfo, packageType: string): string {
        if (packageType == "sdk") {
            if (versionInfo["runtime-version"]) {
                return versionInfo["runtime-version"];
            }

            tl.warning(tl.loc("runtimeVersionPropertyNotFound"));
        }
        else {
            return versionInfo.version;
        }

        return "";
    }
}

export class VersionFilesData {
    public name: string;
    public url: string;
    public rid: string;
    public hash?: string;
}

const DotNetCoreReleasesIndexUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases-index.json";