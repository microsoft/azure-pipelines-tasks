import * as util from 'util'
import * as tl from 'vsts-task-lib/task';
import * as definitions from "./definitions";
import * as azCopyProvider from "./azCopyProvider";

export default class BlobService {
    private _storageAccountName: string;
    private _storageAccessKey: string;

    constructor(storageAccountName: string, storageAccessKey: string) {
        this._storageAccountName = storageAccountName;
        this._storageAccessKey = storageAccessKey;
    }

    /**
     * uploads a local folder content to blob container
     */
    public async uploadBlobs(source: string, destUrlOrContainer: string): Promise<void> {
        let destUrl = destUrlOrContainer;
        if(!this._isUrl(destUrlOrContainer)) {
            destUrl = util.format("https://%s.blob.core.windows.net/%s", this._storageAccountName, destUrlOrContainer);
        }

        if(tl.osType().match(/^Win/)) {
            let azCopy = new azCopyProvider.AzCopyWindows();
            return azCopy.uploadBlobs(source, destUrl, this._storageAccessKey);
        } else {
            // use REST APIs to upload
            throw "Not implemented!!";
        }
    }

    private _isUrl(str: string): boolean {
        if(!!str && (str.startsWith("https://") || str.startsWith("http://"))) {
            return true;
        }

        return false;
    }
}