import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as fs from 'fs';

/**
 * Represents an item to be downloaded
 */
export interface DownloadItem<T> {
    /**
     * The path to the item, relative to the target path
     */
    relativePath: string;
    
    /**
     * Artifact-specific data
     */
    data: T;
}

/**
 * Downloads items
 * @param items the items to download
 * @param targetPath the folder that will hold the downloaded items
 * @param maxConcurrency the maximum number of items to download simultaneously
 * @param downloader a function that, given a DownloadItem, will return a content stream
 */
export async function download<T>(items: DownloadItem<T>[], targetPath: string, maxConcurrency: number, downloader: (item: DownloadItem<T>) => Promise<fs.ReadStream>): Promise<void> {
    // keep track of folders we've touched so we don't call mkdirP for every single file
    let createdFolders: { [key: string]: boolean } = {};
    let downloaders: Promise<{}>[] = [];

    let fileCount: number = items.length;
    let logProgress = fileCount < 100 ? logProgressFilename : logProgressPercentage;

    maxConcurrency = Math.min(maxConcurrency, items.length);
    for (let i = 0; i < maxConcurrency; ++i) {
        downloaders.push(new Promise(async (resolve, reject) => {
            try {
                while (items.length > 0) {
                    let item = items.pop();
                    let fileIndex = fileCount - items.length;

                    // the full path of the downloaded file
                    let outputFilename = path.join(targetPath, item.relativePath);

                    // create the folder if necessary
                    let folder = path.dirname(outputFilename);
                    if (!createdFolders.hasOwnProperty(folder)) {
                        if (!tl.exist(folder)) {
                            tl.mkdirP(folder);
                        }
                        createdFolders[folder] = true;
                    }

                    logProgress(item.relativePath, outputFilename, fileIndex, fileCount);
                    await new Promise(async (downloadResolve, downloadReject) => {
                        try {
                            // get the content stream from the provider
                            let contentStream = await downloader(item);

                            // create the target stream
                            let outputStream = fs.createWriteStream(outputFilename);

                            // pipe the content to the target
                            contentStream.pipe(outputStream);
                            contentStream.on('end', () => {
                                tl.debug(`Downloaded '${item.relativePath}' to '${outputFilename}'`);
                                downloadResolve();
                            });
                        }
                        catch (err) {
                            console.log(tl.loc("DownloadError", item.relativePath));
                            downloadReject(err);
                        }
                    });
                }
                resolve();
            }
            catch (err) {
                reject(err);
            }
        }));
    }

    await Promise.all(downloaders);
}

function logProgressFilename(relativePath: string, outputFilename: string, fileIndex: number, fileCount: number): void {
    console.log(tl.loc("DownloadingFile", relativePath, outputFilename, fileIndex, fileCount));
}

function logProgressPercentage(relativePath: string, outputFilename: string, fileIndex: number, fileCount: number): void {
    let percentage = (fileIndex / fileCount) * 100;
    if (Math.floor(percentage) > Math.floor(((fileIndex - 1) / fileCount) * 100)) {
        console.log(tl.loc("DownloadingPercentage", percentage.toFixed(2), fileIndex, fileCount));
    }
}