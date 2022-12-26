"use strict";

var https   = require('https');
var fs      = require('fs');
import * as os from "os";
import * as path from "path";
import * as stream from "stream";
var DecompressZip = require('decompress-zip');
import * as tl from "azure-pipelines-task-lib/task";

// copy source file to destination folder. destination folder will be created if it does not exists, otherwise its contents will be overwritten.
export function copyFile(sourceFile: string, destinationFolder: string): void {
    tl.checkPath(sourceFile, tl.loc("CopySourceNotExists", sourceFile));

    if(!tl.exist(destinationFolder)) {
        console.log(tl.loc("CreatingDestinationDir", destinationFolder));
        tl.mkdirP(destinationFolder);
        console.log(tl.loc("CreatedDestinationDir", destinationFolder));
    }

    tl.cp(sourceFile, destinationFolder, "-f")
}

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

export async function unzip(zipLocation, unzipLocation): Promise<string> {

    var finishPromise = new Promise<string>(function (resolve, reject) {
        if(tl.exist(unzipLocation)) {
            tl.rmRF(unzipLocation);
        }

        var unzipper = new DecompressZip(zipLocation);
        tl.debug('extracting ' + zipLocation + ' to ' + unzipLocation);
        unzipper.on('error', err => reject(err));
        unzipper.on('extract', log => {
            tl.debug('extracted ' + zipLocation + ' to ' + unzipLocation + ' Successfully');
            resolve(unzipLocation);
        });

        unzipper.extract({
            path: unzipLocation
        });
    });

    return finishPromise;
}

export function readJsonFile(filePath: string): string {
    var content = null;
    if (tl.exist(filePath)) {
        var content = fs.readFileSync(filePath, 'utf8').toString();

        // remove BOM
        if (content.indexOf('\uFEFF') == 0) {
            content = content.slice(1);
        }
    }
    else {
        tl.debug('Json file not found: ' + filePath);
    }
    return content;
}

export function generateTemporaryFilePath (): string {
    let filePath: string = path.resolve(tl.getVariable('Agent.TempDirectory'), Math.random().toString(36).replace('0.', '') + '.json');
    return filePath;
}

export function getPackerVarFileContent (templateVariables: Map<string, string>): string {
    let res = {};
    templateVariables.forEach((value: string, key: string) => {
        res[key] = value
    });
    let content: string = JSON.stringify(res);
    return content;
}

export function writeFile(filePath: string, content: string): void {
    tl.writeFile(filePath, content);
}

export function findMatch(root: string, patterns: string[] | string): string[] {
    return tl.findMatch(root, patterns);
}

export function getTempDirectory(): string {
    return tl.getVariable('Agent.TempDirectory');
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getCurrentDirectory(): string {
    return __dirname;
}

export function isGreaterVersion(firstVersion: PackerVersion, secondVersion: PackerVersion): boolean {
    if(firstVersion.major > secondVersion.major) {
        return true;
    } else if(firstVersion.major === secondVersion.major && firstVersion.minor > secondVersion.minor) {
        return true;
    } else if(firstVersion.major === secondVersion.major && firstVersion.minor === secondVersion.minor && firstVersion.patch > secondVersion.patch) {
        return true;
    }

    return false;
}

export function IsNullOrEmpty(str: string): boolean {
    if(str === null || str === undefined || str === "") {
        return true;
    }

    return false;
}

export function HasItems(arr: any[]): boolean {
    if(arr === null || arr === undefined || arr.length === 0) {
        return false;
    }

    return true;
}

export function sleep (time): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, time));
}

export function deleteDirectory(dir: string): void {
    if(!dir) {
        return;
    }

    if(tl.exist(dir)) {
        tl.debug("Cleaning-up directory " + dir);
        try {
            tl.rmRF(dir);
        } catch(error) {}
    }
}

// Extends stream.Writable to support parsing data as they are written
export class StringWritable extends stream.Writable {

    constructor(options, parserCallback?) {
        super(options);
        this._parserCallback = parserCallback;
    }

    _write(data: any, encoding: BufferEncoding, callback: Function): void {
        console.log(data.toString());

        if(!!this._parserCallback) {
            this._parserCallback(data.toString());
        }

        if (callback) {
            callback();
        }
    }

    private _parserCallback: (line: string) => void;
};

export class PackerVersion {
    public major: number;
    public minor: number;
    public patch: number;

    public static convertFromString(versionString: string): PackerVersion {
        var parts = versionString.split('.');
        if(parts.length !== 3) {
            throw tl.loc("InvalidPackerVersionString", versionString);
        }

        return <PackerVersion>{
            major: parseInt(parts[0]),
            minor: parseInt(parts[1]),
            patch: parseInt(parts[2])
        };
    }
}