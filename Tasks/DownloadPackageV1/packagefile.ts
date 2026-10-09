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
    private rootLocation: string;
    private filename: string;

    // file will be extracted to this location
    private finalLocation: string;
    private extractFile: boolean;

    constructor(extract: boolean, destination: string, filename: string) {
        this.finalLocation = destination;
        this.extractFile = extract;
        this.filename = filename;

        if (extract) {
            this.rootLocation = path.resolve(tl.getVariable('Agent.TempDirectory'));
        } else {
            this.rootLocation = path.resolve(destination);
        }

        this.initialLocation = this.resolveContainedPath(filename);
    }

    public async process(): Promise<void> {
        if (this.extractFile) {
            this.validateNoLinks();
            return this.extract();
        }
    }

    public removeExisting(): void {
        this.validateNoLinks();
        tl.rmRF(this.initialLocation);
    }

    public writeContent(content: string): Promise<void> {
        this.validateNoLinks();

        return new Promise<void>((resolve, reject) => {
            fs.writeFile(this.initialLocation, content, error => {
                if (error) {
                    return reject(error);
                }

                resolve();
            });
        });
    }

    public createWriteStream(): fs.WriteStream {
        this.validateNoLinks();
        return fs.createWriteStream(this.initialLocation);
    }

    get downloadPath() {
        return this.initialLocation;
    }

    private validateNoLinks(): void {
        const relativePath = path.relative(this.rootLocation, this.initialLocation);
        let currentPath = this.rootLocation;

        for (const segment of relativePath.split(path.sep)) {
            currentPath = path.join(currentPath, segment);

            try {
                if (fs.lstatSync(currentPath).isSymbolicLink()) {
                    throw new Error(tl.loc("InvalidPackageFileLink", this.filename));
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return;
                }

                throw error;
            }
        }
    }

    private resolveContainedPath(filename: string): string {
        const hasParentSegment = filename.split(/[\\/]+/).includes("..");
        const hasWindowsRoot = path.win32.parse(filename).root !== "";

        if (!filename || path.posix.isAbsolute(filename) || hasWindowsRoot || hasParentSegment) {
            throw new Error(tl.loc("InvalidPackageFilePath", filename));
        }

        const resolvedPath = path.resolve(this.rootLocation, filename);
        const relativePath = path.relative(this.rootLocation, resolvedPath);
        const escapesRoot =
            !relativePath ||
            relativePath === ".." ||
            relativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativePath);

        if (escapesRoot) {
            throw new Error(tl.loc("InvalidPackageFilePath", filename));
        }

        return resolvedPath;
    }

    private async extract(): Promise<void> {
        const fileEnding = path.parse(this.initialLocation).ext;
        tl.debug("Extracting file: " + this.initialLocation + " to " + this.finalLocation);
        tl.debug("File ending: " + fileEnding);
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
