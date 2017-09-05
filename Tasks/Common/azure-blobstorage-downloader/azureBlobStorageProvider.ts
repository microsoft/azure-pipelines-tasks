import path = require('path');
import fs = require('fs');
import azureStorage = require('azure-storage');
import models = require('item-level-downloader/Models');
import Stream = require("stream");

export class AzureBlobProvider implements models.IArtifactProvider {
    constructor(storageAccount: string, container: string, accessKey: string, prefixFolderPath?: string) {
        this._storageAccount = storageAccount;
        this._accessKey = accessKey;
        this._container = container;
        this._prefixFolderPath = prefixFolderPath;
        this._blobSvc = azureStorage.createBlobService(this._storageAccount, this._accessKey);
        this._maxListSize = 100;
    }

    public putArtifactItem(item: models.ArtifactItem, readStream: Stream.Readable): Promise<models.ArtifactItem> {
        return new Promise(async (resolve, reject) => {
            var newArtifactItem: models.ArtifactItem = models.ArtifactItem.clone(item);
            await this._ensureContainerExistence();

            var self = this;
            console.log("Uploading '%s'", item.path);
            var blobPath = this._prefixFolderPath ? this._prefixFolderPath + "/" + item.path : item.path;

            var writeStream = this._blobSvc.createWriteStreamToBlockBlob(this._container, blobPath, null, function (error, result, response) {
                if (error) {
                    console.log("Failed to create blob " + blobPath + ". Error: " + error.message);
                    reject(error);
                } else {
                    var blobUrl = self._blobSvc.getUrl(self._container, blobPath);
                    console.log("Created blob for item " + item.path + ". Blob uri: " + blobUrl);
                    newArtifactItem.metadata["downloadUrl"] = blobUrl;
                    resolve(newArtifactItem);
                }
            });

            readStream.pipe(writeStream);
            writeStream.on("error",
                (error) => {
                    reject(error);
                });
            readStream.on("error",
                (error) => {
                    reject(error);
                });
        });
    }

    public getRootItems(): Promise<models.ArtifactItem[]> {
        return new Promise(async (resolve, reject) => {
            var items: models.ArtifactItem[] = await this._getItems(this._container)
            resolve(items);
        });
    }

    public getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        return new Promise(async (resolve, reject) => {
            var items: models.ArtifactItem[] = await this._getItems(this._container, artifactItem.path);
            resolve(items);
        });
    }

    public getArtifactItem(artifactItem: models.ArtifactItem): Promise<Stream.Readable> {
        return new Promise(async (resolve, reject) => {
            var readStream: Stream.Readable = this._blobSvc.createReadStream(this._container, artifactItem.path, (error, result) => {
                if (error) {
                    console.log("Unable to fetch item: " + artifactItem.path + ". Error: " + error);
                    reject();
                }
            });
            resolve(readStream);
        });
    }

    private _ensureContainerExistence(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!this._isContainerExists) {
                var self = this;
                this._blobSvc.createContainerIfNotExists(this._container, function (error, result, response) {
                    if (!!error) {
                        console.log("Failed to create container " + self._container + ". Error: " + error.message);
                        reject(error);
                    } else {
                        self._isContainerExists = true;
                        console.log("Created container " + self._container);
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
            await this._ensureContainerExistence();

            var self = this;
            this._blobSvc.listBlobsSegmented(container, null, (error, result, response) => {
                if (!!error) {
                    console.log("Failed to list items inside container: " + self._container + ". Error: " + error.message);
                    reject(error);
                } else {
                    console.log("Successfully fetcted list of items.");
                    items = self._convertBlobResultToArtifactItem(result.entries);
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
            artifactitem.metadata = element.metadata;
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
    private _maxListSize: number;
}