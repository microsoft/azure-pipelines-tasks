import * as util from 'util';
import * as taskLib from 'vsts-task-lib/task';

import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { HttpClientResponse } from 'typed-rest-client/HttpClient';

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

        if (releasesInfo.length == 0) {
            throw taskLib.loc("VersionNotFound", version);
        }

        let release = releasesInfo[0];
        let blobUrl: string = release['blob-' + type];
        let dlcUrl: string = release['dlc-' + type];
        let fileName: string = release[type + '-' + osSuffixes[0]] ? release[type + '-' + osSuffixes[0]] : release[type + '-' + osSuffixes[1]];

        if (!!fileName) {
            if (!!blobUrl) {
                downloadUrls.push(util.format("%s%s", blobUrl.trim(), fileName.trim()));
            }

            if (!!dlcUrl) {
                downloadUrls.push(util.format("%s%s", dlcUrl.trim(), fileName.trim()));
            }
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
}

const DotNetCoreReleasesUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases.json";