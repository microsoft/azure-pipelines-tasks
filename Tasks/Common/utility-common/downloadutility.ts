"use strict";

var https   = require('https');
var fs      = require('fs');
var url = require('url');
import * as tl from "vsts-task-lib/task";

export async function download(options: any, downloadPath: string, printData: boolean, isRedirectUrl: boolean = false): Promise<void> {
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

                if(res.statusCode < 200 || res.statusCode >= 300) {         
                    if((res.statusCode >= 300 || res.statusCode < 400)
                        && !isRedirectUrl
                        && res.headers 
                        && res.headers.location) {
                            var redirectUrl = res.headers.location;
                            tl.debug("Download latest release from redirect uri: " + redirectUrl);
                            if (typeof options === 'string') {
                                options = redirectUrl;
                            }
                            else {
                                try {
                                    var redirectUrlOptions = url.parse(redirectUrl, true, true);
                                    options.path = redirectUrlOptions.pathname;
                                    options.hostname = redirectUrlOptions.hostname;
                                }
                                catch(error) {
                                    tl.warning("Unable to parse url:" + redirectUrl);
                                    options = redirectUrl;
                                }
                            }

                            resolve(this.download(options, downloadPath, printData, true));
                    }
                    else {
                        tl.debug("File download failed");
                        reject(new Error('Failed to download file status code: ' + res.statusCode));
                    }
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