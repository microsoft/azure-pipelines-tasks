import * as path from 'path';
import * as util from 'util'
import * as tl from 'vsts-task-lib/task';

export class BlobService {
    private _storageAccountName: string;
    private _storageAccessKey: string;

    public constructor(storageAccountName: string, storageAccessKey: string) {
        this._storageAccountName = storageAccountName;
        this._storageAccessKey = storageAccessKey;
    }

    /**
     * uploads a local folder content to blob container
     */
    public async uploadBlobs(source: string, destUrlOrContainer: string): Promise<void> {
        throw "Not implemented!!";
    }

    private _isUrl(str: string): boolean {
        if(!!str && (str.startsWith("https://") || str.startsWith("http://"))) {
            return true;
        }

        return false;
    }

    public normalizeRelativePath(inputPath: string) {
        if(tl.osType().match(/^Win/)) {
            var splitPath = inputPath.split(path.sep);
            return path.posix.join.apply(null, splitPath);
        }

        return inputPath;
    }
}