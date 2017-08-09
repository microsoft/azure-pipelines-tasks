import * as azureStorage from 'azure-storage';
import * as path from 'path';
import * as util from 'util'
import * as tl from 'vsts-task-lib/task';

export default class BlobService {
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
        let destUrl = destUrlOrContainer;
        if(!this._isUrl(destUrlOrContainer)) {
            destUrl = util.format("https://%s.blob.core.windows.net/%s", this._storageAccountName, destUrlOrContainer);
        }

        if(tl.osType().match(/^Win/)) {
            //let azCopy = new azCopyProvider.AzCopyWindows();
            //return azCopy.uploadBlobs(source, destUrl, this._storageAccessKey);
            var self = this;
            var blobSvc = azureStorage.createBlobService(this._storageAccountName, this._storageAccessKey);
            blobSvc.createContainerIfNotExists(destUrlOrContainer, function(error, result, response){
            if(!error){
                // Container exists and is private
                    let fileList: string[] = tl.findMatch(source, "**/*.*");
                    let baseFolder = Date.now().toString();

                    let fileUris: string[] = [];
                    fileList.forEach((filePath) => {
                        let fileName = path.basename(filePath);
                        let relativePath = path.relative(source, filePath);
                        let normalizedRelativePath = self.normalizeRelativePath(relativePath);
                        //blobSvc.createBlockBlobFromLocalFile(destUrlOrContainer, baseFolder + "/" + normalizedRelativePath, filePath, function(error, result, response){
                        blobSvc.createBlockBlobFromLocalFile(destUrlOrContainer, normalizedRelativePath, filePath, function(error, result, response){
                            if(error) {
                                console.log(error.message);
                            }
                        });

                    });
                }
            });
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

    public normalizeRelativePath(inputPath: string) {
        if(tl.osType().match(/^Win/)) {
            var splitPath = inputPath.split(path.sep);
            return path.posix.join.apply(null, splitPath);
        }

        return inputPath;
    }
}