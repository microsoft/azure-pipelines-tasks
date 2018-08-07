"use strict";

var https   = require('https');
var fs      = require('fs');
var url = require('url');
import * as tl from "vsts-task-lib/task";

function isDownloadSucceeded(response: any): boolean {
    return response.statusCode >= 200 && response.statusCode < 300;
}

function isRedirect(response: any): boolean {
    return response.statusCode >= 300
             && response.statusCode < 400
             && response.headers
             && response.headers.location;
}

function getRedirectOptions(options: any, redirectUrl: string): any {
    tl.debug("redirect url: " + redirectUrl);
    if (typeof options === 'string') {
        options = redirectUrl;
    }
    else {
        try {
            var redirectUrlOptions = url.parse(redirectUrl);
            options.path = redirectUrlOptions.path;
            options.hostname = redirectUrlOptions.hostname;
        }
        catch(error) {
            tl.warning("Unable to parse url:" + redirectUrl);
            options = redirectUrl;
        }
    }

    return options;
}

export async function download(options: any, downloadPath: string, printData: boolean, handleRedirect: boolean): Promise<void> {
    var file = fs.createWriteStream(downloadPath);
    var body = ''
    return new Promise<void>((resolve, reject) => {
        var req = https.request(options, res => {
            tl.debug("statusCode: " + res.statusCode);
            res.pipe(file);
            res.on("error", err => reject(err));
            res.on('data', d => body += d);
            
            res.on("end", () => {
                file.end(null, null, file.close);
                if(printData) {
                    tl.debug(body);
                }

                if (isDownloadSucceeded(res)) {
                    tl.debug("File download completed");
                    resolve();
                }
                else if (isRedirect(res) && handleRedirect) {
                    var redirectOptions = getRedirectOptions(options, res.headers.location);
                    resolve(this.download(redirectOptions, downloadPath, printData, false));
                }
                else {
                    tl.debug("File download failed");
                    reject(new Error('Failed to download file status code: ' + res.statusCode));
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