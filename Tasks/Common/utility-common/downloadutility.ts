"use strict";

var https = require('https');
var fs = require('fs');
import * as tl from "vsts-task-lib/task";
var typedHttp = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");

export async function download(url: any, downloadPath: string, printData: boolean): Promise<void> {
    var file = fs.createWriteStream(downloadPath);
    var body = ''
    return new Promise<void>((resolve, reject) => {
        var req = https.request(url, res => {
            tl.debug("statusCode: " + res.statusCode);
            res.pipe(file);
            res.on("error", err => reject(err));
            res.on('data', d => body += d);

            res.on("end", () => {
                file.end(null, null, file.close);
                if (printData) {
                    tl.debug(body);
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    tl.debug("File download failed");
                    reject(new Error('Failed to download file status code: ' + res.statusCode));
                }
                else {
                    tl.debug("File download completed");
                    resolve();
                }
            });
        });
        req.on("error", err => {
            tl.debug(err);
            reject(err);
        });

        req.end();
    });
}

export async function readFileContent(url): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let httpClient = getClient();
        httpClient.get(url, {}).then(async (response) => {
            if (response.message.statusCode == 200) {
                let contents: string = "";
                try {
                    contents = await response.readBody();
                } catch (error) {
                    reject(tl.loc("UnableToReadResponseBody", error));
                }
                resolve(contents);
            } else {
                var errorMessage = response.message.statusCode.toString() + ": " + response.message.statusMessage;
                return reject(tl.loc("FileFetchFailed", url, errorMessage));
            }
        }, (error) => {
            return reject(tl.loc("FileFetchFailed", url, error));
        });
    });
}

function getClient() {
    let proxyUrl: string = tl.getVariable("agent.proxyurl");
    var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
        proxy: {
            proxyUrl: proxyUrl,
            proxyUsername: tl.getVariable("agent.proxyusername"),
            proxyPassword: tl.getVariable("agent.proxypassword"),
            proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
        }
    } : {};

    let ignoreSslErrors: string = tl.getVariable("VSTS_TASK_IGNORE_SSL_ERRORS");
    requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";

    return new typedHttp.HttpClient("VSTSTask", null, requestOptions);
}