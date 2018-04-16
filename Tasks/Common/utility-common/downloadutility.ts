"use strict";

var https   = require('https');
var fs      = require('fs');
import * as tl from "vsts-task-lib/task";

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
                if(printData) {
                    tl.debug(body);
                }

                if(res.statusCode < 200 || res.statusCode >= 300) {
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