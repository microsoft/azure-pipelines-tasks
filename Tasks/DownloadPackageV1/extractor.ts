import * as tl from "vsts-task-lib/task";
import * as path from "path";
import * as fs from "fs";
var tar = require("tar-fs");
var zlib = require("zlib");
var DecompressZip = require('decompress-zip');

export class Extractor {
    public readonly win: boolean;

    private zipLocation: string;
    private unzipLocation: string;

    constructor(zipLocation: string, unzipLocation: string) {
        this.zipLocation = zipLocation;
        this.unzipLocation = unzipLocation;
    }

    async extract(): Promise<void> {
        const fileEnding = path.parse(this.zipLocation).ext;
        switch (fileEnding) {
            case ".zip":
                return this.unzip(this.zipLocation, this.unzipLocation);
            case ".tgz":
                return this.unTarGz(this.zipLocation, this.unzipLocation);
            default:
                return Promise.reject(tl.loc("UnsupportedArchiveType", fileEnding));
        }
    }

    async unTarGz(zipLocation: string, unzipLocation: string): Promise<void> {
        return Promise.resolve(
            fs
                .createReadStream(zipLocation)
                .pipe(zlib.createGunzip())
                .pipe(tar.extract(unzipLocation))
        );
    }

    async unzip(zipLocation: string, unzipLocation: string): Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            tl.debug("Extracting " + zipLocation + " to " + unzipLocation);

            var unzipper = new DecompressZip(zipLocation);
            unzipper.on("error", err => {
                return reject(tl.loc("ExtractionFailed", err));
            });
            unzipper.on("extract", () => {
                tl.debug("Extracted " + zipLocation + " to " + unzipLocation + " successfully");
                return resolve();
            });

            unzipper.extract({
                path: unzipLocation
            });
        });
    }
}
