import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";
import * as fs from "fs";
import * as stream from "stream";
import { promisify } from "util";

var tar = require("tar-fs");
var zlib = require("zlib");
var yauzl = require("yauzl");

const pipeline = promisify(stream.pipeline);


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
        tl.debug("Extracting file: " + this.initialLocation + " to " + this.finalLocation);
        tl.debug("File ending: " + fileEnding);
        switch (fileEnding) {
            case ".zip":
            case ".crate":
            case ".nupkg":
                return this.unzipUsingYauzl(this.initialLocation, this.finalLocation);
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

    private async unzipUsingYauzl(zipLocation: string, unzipLocation: string): Promise<void> {
        tl.debug("Extracting " + zipLocation + " to " + unzipLocation);
        tl.debug("Using yauzl package for extracting archive");

        if (!path.isAbsolute(unzipLocation)) {
            throw new Error("Target directory is expected to be absolute");
        }
        await fs.promises.mkdir(unzipLocation, { recursive: true });
        const dir: string = await fs.promises.realpath(unzipLocation);

        await new Promise<void>((resolve, reject) => {
            yauzl.open(zipLocation, { lazyEntries: true }, (err: Error, zipfile: any) => {
                if (err) {
                    return reject(err);
                }

                let canceled: boolean = false;
                const fail = (error: Error) => {
                    if (canceled) {
                        return;
                    }
                    canceled = true;
                    zipfile.close();
                    reject(error);
                };

                zipfile.on("error", fail);
                zipfile.on("close", () => {
                    if (!canceled) {
                        resolve();
                    }
                });
                zipfile.on("entry", (entry: any) => {
                    if (canceled) {
                        return;
                    }
                    if (entry.fileName.startsWith("__MACOSX/")) {
                        zipfile.readEntry();
                        return;
                    }
                    this.extractYauzlEntry(zipfile, entry, dir)
                        .then(() => {
                            if (!canceled) {
                                zipfile.readEntry();
                            }
                        })
                        .catch(fail);
                });

                zipfile.readEntry();
            });
        });
    }

    private async extractYauzlEntry(zipfile: any, entry: any, dir: string): Promise<void> {
        const dest: string = path.resolve(dir, entry.fileName);
        const relativeDest: string = path.relative(dir, dest);
        if (relativeDest.split(path.sep).includes("..") || path.isAbsolute(relativeDest)) {
            throw new Error(`Out of bound path "${dest}" found while processing file ${entry.fileName}`);
        }

        // Reject paths that escape the target directory (zip slip), resolving path symlinks.
        const parentDir: string = path.dirname(dest);
        await fs.promises.mkdir(parentDir, { recursive: true });
        const canonicalParentDir: string = await fs.promises.realpath(parentDir);
        if (path.relative(dir, canonicalParentDir).split(path.sep).includes("..")) {
            throw new Error(`Out of bound path "${canonicalParentDir}" found while processing file ${entry.fileName}`);
        }

        const mode: number = (entry.externalFileAttributes >> 16) & 0xFFFF;
        const IFMT: number = 61440;
        const IFDIR: number = 16384;
        const IFLNK: number = 40960;
        const symlink: boolean = (mode & IFMT) === IFLNK;
        let isDir: boolean = (mode & IFMT) === IFDIR;

        if (!isDir && entry.fileName.endsWith("/")) {
            isDir = true;
        }
        const madeBy: number = entry.versionMadeBy >> 8;
        if (!isDir) {
            isDir = madeBy === 0 && entry.externalFileAttributes === 16;
        }

        const procMode: number = this.getExtractedMode(mode, isDir) & 0o777;
        tl.debug(`extracting entry ${entry.fileName} isDir=${isDir} isSymlink=${symlink}`);

        const targetDir: string = isDir ? dest : path.dirname(dest);
        await fs.promises.mkdir(targetDir, isDir ? { recursive: true, mode: procMode } : { recursive: true });
        if (isDir) {
            return;
        }

        const readStream: stream.Readable = await promisify(zipfile.openReadStream.bind(zipfile))(entry);

        if (symlink) {
            const link: string = await this.readStreamToString(readStream);
            const relativeTarget: string = path.relative(dir, path.resolve(path.dirname(dest), link));
            if (relativeTarget.split(path.sep).includes("..") || path.isAbsolute(relativeTarget)) {
                throw new Error(`Blocked symlink "${entry.fileName}" -> "${link}" that escapes the extraction directory`);
            }
            await fs.promises.symlink(link, dest);
        } else {
            await pipeline(readStream, fs.createWriteStream(dest, { mode: procMode }));
        }
    }

    private readStreamToString(readStream: stream.Readable): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
            readStream.on("end", () => resolve(Buffer.concat(chunks).toString()));
            readStream.on("error", reject);
        });
    }

    private getExtractedMode(entryMode: number, isDir: boolean): number {
        let mode: number = entryMode;
        if (mode === 0) {
            mode = isDir ? 0o755 : 0o644;
        }
        return mode;
    }
}
