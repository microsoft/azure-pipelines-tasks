"use strict";

var https   = require('https');
var fs      = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";
import * as util from "util";

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

    console.log("closing the file");
    file.end(null, null, file.close);    
}

export function getTempDirectory(): string {
    return os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getNewUserDirPath(): string {
    var userDir = path.join(getTempDirectory(), "kubectlTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
} 

function ensureDirExists(dirPath : string) : void
{
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

export async function getStableKubectlVersion() : Promise<string> {
    var version = "v1.6.2";
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), getCurrentTime().toString());
    await download(stableVersionUrl, downloadPath);
    version = fs.readFileSync(downloadPath).toString();
    return version.trim();
}

export async function downloadKubectl(version: string, kubectlPath: string): Promise<void> {
    var kubectlURL = getkubectlDownloadURL(version);
    var kubectlPathTmp = kubectlPath+".tmp";
    await download(kubectlURL, kubectlPathTmp);
    tl.cp(kubectlPathTmp, kubectlPath, "-f");
}

function getkubectlDownloadURL(version: string) : string
{
    switch(os.type())
    {
        case 'Linux':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/linux/amd64/kubectl", version);

        case 'Darwin':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/darwin/amd64/kubectl", version);

        default:
        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/windows/amd64/kubectl.exe", version);   

    }
}