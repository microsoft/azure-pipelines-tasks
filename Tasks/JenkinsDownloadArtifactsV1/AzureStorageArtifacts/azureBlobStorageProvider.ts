import path = require('path');
//import azureStorage = require('azure-storage');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
import fs = require('fs');
import models = require('artifact-engine/Models');
import store = require('artifact-engine/Store');
import * as tl from 'azure-pipelines-task-lib/task';

export class AzureBlobProvider implements models.IArtifactProvider {

    public artifactItemStore: store.ArtifactItemStore;

    constructor(storageAccount: string, container: string, accessKey: string, prefixFolderPath?: string, host?: string, addPrefixToDownloadedItems?: boolean) {
        this._storageAccount = storageAccount;
        this._accessKey = accessKey;
        this._container = container;
        if (!!prefixFolderPath) {
            this._prefixFolderPath = prefixFolderPath.endsWith("/") ? prefixFolderPath : prefixFolderPath + "/";
        } else {
            this._prefixFolderPath = "";
        }
        const sharedKeyCredential = new StorageSharedKeyCredential(this._storageAccount, this._accessKey);
        this._blobSvc  = new BlobServiceClient(
            host,
            sharedKeyCredential
          );
       // this._blobSvc = azureStorage.createBlobService(this._storageAccount, this._accessKey, host);
        this._addPrefixToDownloadedItems = !!addPrefixToDownloadedItems;
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
        throw new Error(tl.loc("GetArtifactItemsNotSupported"));
    }

    public getArtifactItem(artifactItem: models.ArtifactItem): Promise<NodeJS.ReadableStream> {
        return new Promise((resolve, reject) => {
            var readStream: NodeJS.ReadableStream;
            if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
                // Adding prefix path to get the absolute path
                readStream = this._blobSvc.createReadStream(this._container, this._prefixFolderPath + artifactItem.path, null); 
            } else {
                readStream = this._blobSvc.createReadStream(this._container, artifactItem.path, null);
            }
            resolve(readStream);
        });
    }

    public dispose() {
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
        var promise = new Promise<models.ArtifactItem[]>(async (resolve, reject) => {
            var items: models.ArtifactItem[] = [];
            var continuationToken = null;
            var result;
            do {
                result = await this._getListOfItemsInsideContainer(container, parentRelativePath, continuationToken);
                items = items.concat(this._convertBlobResultToArtifactItem(result.entries));
                continuationToken = result.continuationToken;
                if (!!continuationToken) {
                    console.log(tl.loc("ContinuationTokenExistsFetchingRemainingFiles"));
                }
            } while (continuationToken);

            console.log(tl.loc("SuccessFullyFetchedItemList"));
            resolve(items);
        });

        return promise;
    }

    private async _getListOfItemsInsideContainer(container, parentRelativePath, continuationToken): Promise<any> {
        var promise = new Promise<any>((resolve, reject) => {
            this._blobSvc.listBlobsSegmentedWithPrefix(container, parentRelativePath, continuationToken, async (error, result) => {
                if (!!error) {
                    console.log(tl.loc("FailedToListItemInsideContainer", container, error.message));
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        return promise;
    }

    private _convertBlobResultToArtifactItem(blobResult: any[]): models.ArtifactItem[] {
        var artifactItems: models.ArtifactItem[] = new Array<models.ArtifactItem>();
        blobResult.forEach(element => {
            var artifactitem: models.ArtifactItem = new models.ArtifactItem();
            artifactitem.itemType = models.ItemType.File;
            artifactitem.fileLength = parseInt(element.contentLength);
            artifactitem.lastModified = new Date(element.lastModified + 'Z');
            if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
                 // Supplying relative path without prefix; removing the first occurence
                artifactitem.path = element.name.replace(this._prefixFolderPath, "").trim();
            } else {
                artifactitem.path = element.name;
            }
            artifactItems.push(artifactitem);
        });

        return artifactItems;
    }

    private _storageAccount: string;
    private _accessKey: string;
    private _container: string;
    private _prefixFolderPath: string;
    private _isContainerExists: boolean = false;
    private _blobSvc: any;
    private _addPrefixToDownloadedItems: boolean = false;
}