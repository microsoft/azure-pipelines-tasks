import path = require('path');
import azureStorage = require('azure-storage');
import fs = require('fs');
import models = require('artifact-engine/Models');
import tl = require('vsts-task-lib/task');

export class AzureBlobProvider implements models.IArtifactProvider {
    constructor(storageAccount: string, container: string, accessKey: string, prefixFolderPath?: string, host?: string) {
        this._storageAccount = storageAccount;
        this._accessKey = accessKey;
        this._container = container;
        this._prefixFolderPath = prefixFolderPath;
        this._blobSvc = azureStorage.createBlobService(this._storageAccount, this._accessKey, host);
    }

    public putArtifactItem(item: models.ArtifactItem, readStream: NodeJS.ReadableStream): Promise<models.ArtifactItem> {
        return new Promise(async (resolve, reject) => {
            await this._ensureContainerExistence();

            var self = this;
            console.log(tl.loc("UploadingItem", item.path));
            var blobPath = this._prefixFolderPath ? this._prefixFolderPath + "/" + item.path : item.path;

            var writeStream = this._blobSvc.createWriteStreamToBlockBlob(this._container, blobPath, null, function (error, result, response) {
                if (error) {
                    console.log(tl.loc("FailedToUploadBlob", blobPath, error.message));
                    reject(error);
                } else {
                    var blobUrl = self._blobSvc.getUrl(self._container, blobPath);
                    console.log(tl.loc("CreatedBlobForItem", item.path, blobUrl));
                    item.metadata["destinationUrl"] = blobUrl;
                    resolve(item);
                }
            });

            readStream.pipe(writeStream);
            writeStream.on("error",
                (error) => {
                    console.log("ErrorInWriteStream", error);
                    reject(error);
                });
            readStream.on("error",
                (error) => {
                    console.log(tl.loc("ErrorInReadStream", error));
                    reject(error);
                });
        });
    }

    public getRootItems(): Promise<models.ArtifactItem[]> {
        return this._getItems(this._container, this._prefixFolderPath);
    }

    public getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        return this._getItems(this._container, artifactItem.path);
    }

    public getArtifactItem(artifactItem: models.ArtifactItem): Promise<NodeJS.ReadableStream> {
        return new Promise((resolve, reject) => {
            var readStream: NodeJS.ReadableStream = this._blobSvc.createReadStream(this._container, artifactItem.path, null);
            resolve(readStream);
        });
    }

    private _ensureContainerExistence(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this._isContainerExists) {
                var self = this;
                this._blobSvc.createContainerIfNotExists(this._container, function (error, result, response) {
                    if (!!error) {
                        console.log(tl.loc("FailedToCreateContainer", self._container, error.message));
                        reject(error);
                    } else {
                        self._isContainerExists = true;
                        console.log(tl.loc("CreatedContainer", self._container));
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    private _getItems(container: string, parentRelativePath?: string): Promise<models.ArtifactItem[]> {
        var promise = new Promise<models.ArtifactItem[]>((resolve, reject) => {
            var items: models.ArtifactItem[] = [];

            this._blobSvc.listBlobsSegmentedWithPrefix(container, parentRelativePath, null, (error, result) => {
                if (!!error) {
                    console.log(tl.loc("FailedToListItemInsideContainer", container, error.message));
                    reject(error);
                } else {
                    console.log(tl.loc("SuccessFullyFetchedItemList"));
                    if (result.continuationToken) {
                        tl.warning(tl.loc("ArtifactItemsTruncationWarning"));
                    }
                    items = this._convertBlobResultToArtifactItem(result.entries);
                    resolve(items);
                }
            });
        });

        return promise;
    }

    private _convertBlobResultToArtifactItem(blobResult: azureStorage.BlobService.BlobResult[]): models.ArtifactItem[] {
        var artifactItems: models.ArtifactItem[] = new Array<models.ArtifactItem>();
        blobResult.forEach(element => {
            var artifactitem: models.ArtifactItem = new models.ArtifactItem();
            artifactitem.itemType = models.ItemType.File;
            artifactitem.fileLength = parseInt(element.contentLength);
            artifactitem.lastModified = new Date(element.lastModified + 'Z');
            artifactitem.path = element.name;
            artifactItems.push(artifactitem);
        });

        return artifactItems;
    }

    private _storageAccount: string;
    private _accessKey: string;
    private _container: string;
    private _prefixFolderPath: string;
    private _isContainerExists: boolean = false;
    private _blobSvc: azureStorage.BlobService;
}