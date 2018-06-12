import * as util from 'util';
import * as taskLib from 'vsts-task-lib/task';

import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");
import { HttpClientResponse } from 'typed-rest-client/HttpClient';

export class DotNetCoreReleaseFetcher {

    public async getDownloadUrl(platforms: string[], version: string, type: string) {
        let releasesCSV = await this.getReleasesCSV();
        let versionsInfo = this.csvToJsonArray(await releasesCSV.readBody());
        let selectedVersionInfos: any[] = versionsInfo.filter(versionInfo => {
            return (versionInfo['version-' + type] === version || versionInfo['version-' + type + '-display'] === version);
        });

        if (selectedVersionInfos === null || selectedVersionInfos.length == 0) {
            throw taskLib.loc("VersionNotFound", version);
        }

        let selectedVersion = selectedVersionInfos[0];
        let rootUrl: string = selectedVersion['blob-' + type];;
        let fileName: string = selectedVersion[type + '-' + platforms[0]];;
        if (!rootUrl) {
            rootUrl = selectedVersion['dlc-' + type];
        }
        if (!fileName) {
            fileName = selectedVersion[type + '-' + platforms[1]];
        }

        if (!rootUrl || !fileName) {
            throw taskLib.loc("NullDownloadUrls", version);
        }

        let downloadUrl: string = util.format("%s%s", rootUrl.trim(), fileName.trim());
        return downloadUrl;
    }

    private getReleasesCSV(): Promise<HttpClientResponse> {
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

    private csvToJsonArray(content: string) {
        let lines = content.split('\n');
        let fieldDelimiter = ",";
        let headers = lines[0].split(fieldDelimiter);
        headers.forEach(header => header.trim());

        let jsonResult = [];
        for (let i = 1; i < lines.length; i++) {
            let currentLine = lines[i].split(fieldDelimiter);
            currentLine.forEach(field => field.trim());
            jsonResult.push(this.buildJsonRow(headers, currentLine));
        }

        return jsonResult;
    }

    private buildJsonRow(headers, currentLine) {
        let jsonObject = {};
        for (let j = 0; j < headers.length; j++) {
            let propertyName = headers[j];
            let value = currentLine[j];
            jsonObject[propertyName] = value;
        }
        return jsonObject;
    }
}

const DotNetCoreReleasesUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases.csv";