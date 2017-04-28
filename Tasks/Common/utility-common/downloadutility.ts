"use strict";

var https   = require('https');
var fs      = require('fs');
import * as tl from "vsts-task-lib/task";

export async function download(url: string, downloadPath: string): Promise<void> {
    var file = fs.createWriteStream(downloadPath);
    await new Promise((resolve, reject) => {
        var req = https.request(url, res => {
            tl.debug("statusCode: " + res.statusCode);
            res.pipe(file);
            res.on("error", err => reject(err));
            res.on("end", () => {
                tl.debug("File download completed");
                resolve();
            });
        });

        req.on("error", err => {
            tl.debug(err);
            reject(err);
        });

        req.end();
    });
    
    file.end(null, null, file.close);    
}