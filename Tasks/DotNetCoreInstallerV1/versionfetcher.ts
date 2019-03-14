import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import * as tl from 'vsts-task-lib/task';
import * as trm from 'vsts-task-lib/toolrunner';

import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { HttpClientResponse } from 'typed-rest-client/HttpClient';

import * as utils from "./versionutilities";

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
        this.channels = [];
    }

    public async getVersionInfo(versionSpec: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        var requiredVersionInfo: VersionInfo = null;
        if (!this.channels || this.channels.length < 1) {
            await this.setReleasesIndex();
        }

        let channelInformation = this.getVersionChannel(versionSpec);
        if (channelInformation) {
            requiredVersionInfo = await this.getVersionFromChannel(channelInformation, versionSpec, packageType, includePreviewVersions);
        }

        if (!requiredVersionInfo && !versionSpec.endsWith("x")) {
            console.log(tl.loc("FallingBackToAdjacentChannels", versionSpec));
            requiredVersionInfo = await this.getVersionFromOtherChannels(versionSpec, packageType, includePreviewVersions);
        }

        if (!requiredVersionInfo) {
            throw tl.loc("VersionNotFound", packageType, versionSpec);
        }

        let dotNetSdkVersionTelemetry = `{"userVersion":"${versionSpec}", "resolvedVersion":"${requiredVersionInfo.version}"}`;
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=DotNetCoreInstallerV1]" + dotNetSdkVersionTelemetry);
        return requiredVersionInfo;
    }

    public getDownloadUrl(versionInfo: VersionInfo, packageType: string): string {
        console.log(tl.loc("GettingDownloadUrl", packageType, versionInfo.version));

        let osSuffixes = this.detectMachineOS();
        let downloadPackageInfoObject: VersionFilesData = null;
        osSuffixes.find((osSuffix) => {
            downloadPackageInfoObject = versionInfo.files.find((downloadPackageInfo: VersionFilesData) => {
                if (downloadPackageInfo.rid && osSuffix && downloadPackageInfo.rid.toLowerCase() == osSuffix.toLowerCase()) {
                    if ((osSuffix.split("-")[0] != "win" && osSuffix.split("-")[0] != "osx") || (osSuffix.split("-")[0] == "win" && downloadPackageInfo.name.endsWith(".zip")) || (osSuffix.split("-")[0] == "osx" && downloadPackageInfo.name.endsWith("tar.gz"))) {
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

        throw tl.loc("DownloadUrlForMatchingOsNotFound", packageType, versionInfo.version, osSuffixes.toString());
    }

    private setReleasesIndex(): Promise<void> {
        return this.httpCallbackClient.get(DotNetCoreReleasesIndexUrl)
            .then((response: HttpClientResponse) => {
                return response.readBody();
            })
            .then((body: string) => {
                let parsedReleasesIndexBody = JSON.parse(body);
                if (!parsedReleasesIndexBody || !parsedReleasesIndexBody["releases-index"] || parsedReleasesIndexBody["releases-index"].length < 1) {
                    throw "Parsed releases index body is not correct."
                }

                parsedReleasesIndexBody["releases-index"].forEach(channelRelease => {
                    if (channelRelease) {
                        try {
                            this.channels.push(new Channel(channelRelease));
                        }
                        catch (ex) {
                            tl.debug("Channel information in releases-index.json was not proper. Error: " + JSON.stringify(ex));
                            // do not fail, try to find version in the available channels.
                        }
                    }
                });
            })
            .catch((ex) => {
                throw tl.loc("ExceptionWhileDownloadOrReadReleasesIndex", JSON.stringify(ex));
            });
    }

    private getVersionChannel(versionSpec: string): Channel {
        let versionParts = new utils.VersionParts(versionSpec);

        let requiredChannelVersion = `${versionParts.majorVersion}.${versionParts.minorVersion}`;
        if (versionParts.minorVersion == "x") {
            var latestChannelVersion: string = `${versionParts.majorVersion}.0`;
            this.channels.forEach(channel => {
                // todo: should also check if the channel is in preview state, if so then only select the channel if includePreviewVersion should be true.
                // As a channel with state in preview will only have preview releases.
                // example: versionSpec: 3.x Channels: 3.0 (current), 3.1 (preview).
                // if (includePreviewVersion == true) select 3.1
                // else select 3.0
                if (utils.compareChannelVersion(channel.channelVersion, latestChannelVersion) > 0 && channel.channelVersion.startsWith(versionParts.majorVersion)) {
                    latestChannelVersion = channel.channelVersion;
                }
            });

            requiredChannelVersion = latestChannelVersion;
        }

        tl.debug(tl.loc("RequiredChannelVersionForSpec", requiredChannelVersion, versionSpec));
        return this.channels.find(channel => {
            if (channel.channelVersion == requiredChannelVersion) {
                return true
            }
        });
    }

    private getVersionFromChannel(channelInformation: Channel, versionSpec: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        var releasesJsonUrl: string = channelInformation.releasesJsonUrl;

        if (releasesJsonUrl) {
            return this.httpCallbackClient.get(releasesJsonUrl)
                .then((response: HttpClientResponse) => {
                    return response.readBody();
                })
                .then((body: string) => {
                    var channelReleases = JSON.parse(body).releases;

                    let versionInfoList: VersionInfo[] = [];
                    channelReleases.forEach((release) => {
                        if (release && release[packageType] && release[packageType].version) {
                            versionInfoList.push(release[packageType]);
                        }
                    });

                    let matchedVersionInfo = utils.getMatchingVersionFromList(versionInfoList, versionSpec, includePreviewVersions);
                    if (!matchedVersionInfo) {
                        console.log(tl.loc("MatchingVersionNotFound", packageType, versionSpec));
                        return null;
                    }

                    console.log(tl.loc("MatchingVersionForUserInputVersion", matchedVersionInfo.version, channelInformation.channelVersion, versionSpec))
                    return matchedVersionInfo;
                })
                .catch((ex) => {
                    tl.error(tl.loc("ErrorWhileGettingVersionFromChannel", versionSpec, channelInformation.channelVersion, JSON.stringify(ex)));
                    return null;
                });
        }
        else {
            tl.error(tl.loc("UrlForReleaseChannelNotFound", channelInformation.channelVersion));
        }
    }

    private async getVersionFromOtherChannels(version: string, packageType: string, includePreviewVersions: boolean): Promise<VersionInfo> {
        let fallbackChannels = this.getChannelsForMajorVersion(version);
        if (!fallbackChannels && fallbackChannels.length < 1) {
            throw tl.loc("NoSuitableChannelWereFound", version);
        }

        var versionInfo: VersionInfo = null;
        for (var i = 0; i < fallbackChannels.length; i++) {
            console.log(tl.loc("LookingForVersionInChannel", (fallbackChannels[i]).channelVersion));
            versionInfo = await this.getVersionFromChannel(fallbackChannels[i], version, packageType, includePreviewVersions);

            if (versionInfo) {
                break;
            }
        }

        return versionInfo;
    }

    private getChannelsForMajorVersion(version: string): Channel[] {
        var versionParts = new utils.VersionParts(version);
        let adjacentChannels: Channel[] = [];
        this.channels.forEach(channel => {
            if (channel.channelVersion.startsWith(`${versionParts.majorVersion}`)) {
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
            throw tl.loc("FailedInDetectingMachineArch", JSON.stringify(ex));
        }

        return osSuffix;
    }

    private setFileAttribute(file: string, mode: string): void {
        fs.chmodSync(file, mode);
    }

    private getCurrentDir(): string {
        return __dirname;
    }

    private channels: Channel[];
    private httpCallbackClient: httpClient.HttpClient;
}

export class VersionInfo {
    public version: string;
    public files: VersionFilesData[];

    public static getRuntimeVersion(versionInfo: VersionInfo, packageType: string): string {
        if (packageType == utils.Constants.sdk) {
            if (versionInfo["runtime-version"]) {
                return versionInfo["runtime-version"];
            }

            tl.warning(tl.loc("runtimeVersionPropertyNotFound", packageType, versionInfo.version));
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

class Channel {
    constructor(channelRelease: any) {
        if (!channelRelease || !channelRelease["channel-version"] || !channelRelease["releases.json"]) {
            throw "Object cannot be used as Channel, required properties such as channel-version, releases.json is missing. "
        }

        this.channelVersion = channelRelease["channel-version"];
        this.releasesJsonUrl = channelRelease["releases.json"];
    }

    channelVersion: string;
    releasesJsonUrl: string
}

const DotNetCoreReleasesIndexUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases-index.json";