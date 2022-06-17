import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import Q = require('q');

const Zip = require('jszip');

const workDir = tl.getVariable("System.DefaultWorkingDirectory");

export function checkAndFixFilePath(filePath: string, continueOnError: boolean ): string {
    if (filePath) {
        if (arePathEqual(filePath, workDir)) {
            // Path points to the source root, ignore it
            filePath = null;
        } else {
            if (continueOnError) {
                if (!tl.exist(filePath)) {
                    tl.warning(tl.loc("FailedToFindFile", "symbolsPath", filePath));
                    filePath = null;
                }
            } else {
                // will error and fail task if it doesn't exist.
                tl.checkPath(filePath, "symbolsPath");
            }
        }
    }

    return filePath;
}

export function getArchivePath(symbolsRoot: string): string {
    // If symbol paths do not have anything common, e.g /a/b/c and /x/y/z,
    // let's use some default name for the archive.
    let zipName = symbolsRoot ? path.basename(symbolsRoot) : "symbols";
    tl.debug(`---- Zip file name=${zipName}`); 

    let zipPath = path.join(workDir, `${zipName}.zip`); 
    tl.debug(`.... Zip file path=${zipPath}`); 

    return zipPath;
}

function arePathEqual(p1: string, p2: string): boolean {
    if (!p1 && !p2) return true;
    else if (!p1 || !p2) return false;
    else return path.normalize(p1 || "") === path.normalize(p2 || "");
}

function getAllFiles(rootPath: string, recursive: boolean): string[] {
    let files: string[] = [];

    let folders: string[] = [];
    folders.push(rootPath);

    while (folders.length > 0) {
        let folderPath = folders.shift();

        let children = fs.readdirSync(folderPath);
        for (let i = 0; i < children.length; i++) {
            let childPath = [folderPath, children[i]].join( "/");
            if (fs.statSync(childPath).isDirectory()) {
                if (recursive) {
                    folders.push(childPath);
                }
            } else {
                files.push(childPath);
            }
        }
    }

    return files;
}

export function createZipStream(symbolsPaths: string[], symbolsRoot: string): NodeJS.ReadableStream {
    tl.debug("---- Creating Zip stream");
    let zip = new Zip();

    symbolsPaths.forEach(rootPath => {
        let filePaths = getAllFiles(rootPath, /*recursive=*/ true);
        tl.debug(`------ Adding files: ${filePaths}`);

        for (let i = 0; i < filePaths.length; i++) {
            let filePath = filePaths[i];

            let relativePath: string = null;
            if (symbolsRoot) {
                relativePath = path.relative(symbolsRoot, filePath);
            } else {
                // If symbol paths do not have anything common, 
                // e.g "/a/b/c" and "/x/y/z", or "C:/u/v/w" and "D:/u/v/w",
                // let's use "a/b/c" and "x/y/z", or "C/u/v/w" and "D/u/v/w"
                // as relative paths in the archive.
                relativePath = filePath.replace(/^\/+/,"").replace(":", "");
            }

            tl.debug(`...... zip-entry: ${relativePath}`);
            zip.file(relativePath, fs.createReadStream(filePath), { compression: 'DEFLATE' });
        }
    });

    let currentFile = null;
    let zipStream = zip.generateNodeStream({
        base64: false,
        compression: 'DEFLATE',
        type: 'nodebuffer',
        streamFiles: true
    }, function (chunk) {
        if (chunk.currentFile != currentFile) {
            currentFile = chunk.currentFile;
            tl.debug(chunk.currentFile ? "Deflating file: " + chunk.currentFile + ", progress %" + chunk.percent : "done");
        }
    });

    return zipStream;
}

export async function createZipFile(zipStream: NodeJS.ReadableStream, filename: string) {
    return new Promise((resolve, reject) => {
        zipStream.pipe(fs.createWriteStream(filename))
            .on('finish', function () {
                resolve();
            })
            .on('error', function (err) {

                tl.debug(err.message);
                tl.debug(err.stackTrace);

                reject(tl.loc("FailedToCreateFile", filename, err));
            });
    });
}

export function resolveSinglePath(pattern: string, continueOnError?: boolean, packParentFolder?: boolean): string {
    tl.debug("---- Resolving a single path");

    let matches = resolvePaths(pattern, continueOnError, packParentFolder);

    if (matches && matches.length > 0) {
        if (matches.length != 1) {
            if (continueOnError) {
                tl.warning(tl.loc("FoundMultipleFiles", pattern));
            } else {
                throw new Error(tl.loc("FoundMultipleFiles", pattern));
            }
        }

        return matches[0];
    }

    return null;
}

export function resolvePaths(pattern: string, continueOnError?: boolean, packParentFolder?: boolean): string[] {
    tl.debug("------- Resolving multiple paths");
    tl.debug("....... path pattern: " + (pattern || ""));

    if (pattern) {
        let matches = tl.findMatch(null, pattern);

        if (!matches || matches.length === 0) {
            if (continueOnError) {
                tl.warning(tl.loc("CannotFindAnyFile", pattern));
                return null;
            } else {
                throw new Error(tl.loc("CannotFindAnyFile", pattern));
            }
        }

        let selectedPaths = matches.map(v => packParentFolder ? path.dirname(v) : v);
        tl.debug("....... selectedPaths: " + selectedPaths);

        let uniquePaths = removeDuplicates(selectedPaths);
        tl.debug("....... uniquePaths:   " + uniquePaths);

        return uniquePaths;
    }

    return null;
}

export function removeDuplicates(list: string[]): string[] {

    interface IStringDictionary { [name: string]: number }
    let unique: IStringDictionary = {};

    list.forEach(s => {
        unique[s] = 0;
    });

    return Object.keys(unique);
}

export function findCommonParent(list: string[]): string {
    tl.debug("---- Detecting the common parent of all symbols paths to define the archive's internal folder structure.")

    function cutTail(list: string[], n: number) {
        while (n-- > 0) {
            list.pop();
        }
    }

    if (!list) {
        return null;
    }

    let commonSegments: string[] = [];
    let parentPath: string = null;

    list.forEach((nextPath, idx) => {
        tl.debug(`------ next path[${idx}]\t ${nextPath}`);

        if (idx === 0) {
            // Take the first path as the common parent candidate
            commonSegments = nextPath.split("/");
        } else if (commonSegments.length === 0) { 
            // We've already detected that the paths do not have a common parent.
            // No sense to check the rest of paths.
            return null; 
        } else {
            let pathSegmants: string[] = nextPath.split("/");

            // If the current path contains less segments than the common path calculated so far,
            // the trailing segmants in the latter cannot be a part of the resulting common path.
            cutTail(commonSegments, commonSegments.length - pathSegmants.length);

            for (let i = 0; i < pathSegmants.length; i++) {
                if (pathSegmants[i] !== commonSegments[i]) {
                    // Segments i, i+1, etc. cannot be a part of the resulting common path.
                    cutTail(commonSegments, commonSegments.length - i);
                    break;
                }
            }
        }

        parentPath = commonSegments.join("/");
        tl.debug(`...... parent path  \t ${parentPath}`);
    })

    return parentPath;
}


