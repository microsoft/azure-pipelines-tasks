import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import * as extract from 'extract-zip'

var tar = require("tar-fs");
var zlib = require("zlib");


export class PackageFile {
    public readonly win: boolean;

    // file will be downloaded here
    private initialLocation: string;

    // file will be extracted to this location
    private finalLocation: string;
    private extractFile: boolean;

    constructor(extract: boolean, destination: string, filename: string) {
        this.finalLocation = destination;
        this.extractFile = extract;

        if (extract) {
            this.initialLocation = path.resolve(tl.getVariable('Agent.TempDirectory'), filename);
        } else {
            this.initialLocation = path.resolve(destination, filename);
        }
    }

    public async process(): Promise<void> {
        if (this.extractFile) {
            return this.extract();
        }
    }

    get downloadPath() {
        return this.initialLocation;
    }

    private async extract(): Promise<void> {
        const fileEnding = path.parse(this.initialLocation).ext;
        switch (fileEnding) {
            case ".zip":
            case ".crate":
            case ".nupkg":
                return this.unzip(this.initialLocation, this.finalLocation);
            case ".tgz":
                return this.unTarGz(this.initialLocation, this.finalLocation);
            default:
                return Promise.reject(tl.loc("UnsupportedArchiveType", fileEnding));
        }
    }

    private async unTarGz(zipLocation: string, unzipLocation: string): Promise<void> {
        return Promise.resolve(
            fs
                .createReadStream(zipLocation)
                .pipe(zlib.createGunzip())
                .pipe(tar.extract(unzipLocation))
        );
    }

    private async unzip(zipLocation: string, unzipLocation: string): Promise<void> {
        return new Promise<void>(function(resolve, reject) {
            tl.debug("Extracting " + zipLocation + " to " + unzipLocation);
            tl.debug(`Using extract-zip package for extracting archive`);
            extract(zipLocation, { dir: unzipLocation }).then(() => {
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }
}
