// // Workaround to define globalThis for Node 10
var globalThis = require('globalthis')();
(global as any).globalThis = globalThis;

import path = require('path');
import { Readable } from 'stream';
import models = require('artifact-engine/Models');
import store = require('artifact-engine/Store');
import tl = require('azure-pipelines-task-lib/task');
import { BlobItem, BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import abortController = require("@azure/abort-controller");
import {ConnectedServiceTokenCredential } from "./ConnectedSeviceTokenCredential"

const resourcePath: string = path.join(__dirname, 'module.json');
tl.setResourcePath(resourcePath);

export class AzureBlobProvider implements models.IArtifactProvider {

    public artifactItemStore: store.ArtifactItemStore;

    private _storageAccount: string;
    private _accessKey: string;
    private _containerName: string;
    private _prefixFolderPath: string;
    private _containerClient: ContainerClient;
    private _blobServiceClient: BlobServiceClient;
    private _addPrefixToDownloadedItems: boolean = false;
    private _useCredential: boolean = false;
    private _endpoint: any;

    constructor(storageAccount: string, containerName: string, accessKey: string, prefixFolderPath?: string, host?: string, addPrefixToDownloadedItems?: boolean, useCredential?: boolean, endpoint?: any) {
        this._storageAccount = storageAccount;
        this._accessKey = accessKey;
        this._containerName = containerName;
        this._useCredential = useCredential;
        this._endpoint = endpoint;

        if (!!prefixFolderPath) {
            this._prefixFolderPath = prefixFolderPath.endsWith("/") ? prefixFolderPath : prefixFolderPath + "/";
        } else {
            this._prefixFolderPath = "";
        }

        const sharedKeyCredential = new StorageSharedKeyCredential(this._storageAccount, this._accessKey);
        if(this._useCredential)
        {
            const credentialT = new ConnectedServiceTokenCredential(this._endpoint, this.getStorageUrl(this._storageAccount));
            this._blobServiceClient = new BlobServiceClient(this.getStorageUrl(this._storageAccount), credentialT);
        }
        else{
            this._blobServiceClient = new BlobServiceClient(this.getStorageUrl(this._storageAccount), sharedKeyCredential);
        }
        this._containerClient = this._blobServiceClient.getContainerClient(this._containerName);

        this._addPrefixToDownloadedItems = !!addPrefixToDownloadedItems;
    }

    public async putArtifactItem(item: models.ArtifactItem, readStream: Readable): Promise<models.ArtifactItem> {
        await this._containerClient.createIfNotExists();

        const blobPath = this._prefixFolderPath ? this._prefixFolderPath + item.path : item.path;
        console.log(tl.loc("UploadingItem", blobPath));

        const blockBlobClient = this._containerClient.getBlockBlobClient(blobPath);
        
        try {
            const bufferSize = 8 * 1024 * 1024;
            const maxConcurrency = 20;
            const timeoutInMs = 30 * 60 * 1000;

            await blockBlobClient.uploadStream(readStream, bufferSize, maxConcurrency, {
                abortSignal: abortController.AbortController.timeout(timeoutInMs),
            });
    
            const blobUrl = blockBlobClient.url;
            console.log(tl.loc("CreatedBlobForItem", item.path, blobUrl));
            item.metadata["destinationUrl"] = blobUrl;
    
            return item;
        } catch(error) {
            console.log(tl.loc("ErrorInWriteStream", error instanceof Error 
                ? error.message 
                : "Error in write stream"));

            throw error;
        }
    }

    public getRootItems(): Promise<models.ArtifactItem[]> {
        return this._getItems(this._prefixFolderPath);
    }

    public getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        throw new Error(tl.loc("GetArtifactItemsNotSupported"));
    }

    public async getArtifactItem(artifactItem: models.ArtifactItem): Promise<NodeJS.ReadableStream> {
        let blobPath = artifactItem.path;

        if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
            blobPath = this._prefixFolderPath + artifactItem.path;
        }

        const blockBlobClient = this._containerClient.getBlockBlobClient(blobPath);

        const timeoutInMs = 30 * 60 * 1000;
        const offset = 0;
        const count = undefined; // download to the end
            
        try {
            let downloadResponse = await blockBlobClient.download(offset, count, {
                abortSignal: abortController.AbortController.timeout(timeoutInMs),
                maxRetryRequests: 10
            });
                    
            // Replace full path by filename in order to save the file directly to destination folder
            artifactItem.path = path.basename(artifactItem.path);
    
            return downloadResponse.readableStreamBody;

        } catch (error) {
            console.log(tl.loc("ErrorInReadStream", error instanceof Error 
                ? error.message
                : "Error in read stream"));

            throw error;
        }
    }

    public dispose() {
    }

    private async _getItems(parentRelativePath?: string): Promise<models.ArtifactItem[]> {    
        const result = await this._getListOfItemsInsideContainer(parentRelativePath);
        const items = this._convertBlobResultToArtifactItem(result);
        console.log(tl.loc("SuccessFullyFetchedItemList"));
        
        return items;
    }

    private async _getListOfItemsInsideContainer(parentRelativePath: string): Promise<BlobItem[]> {
        const listBlobsOptions = { prefix: parentRelativePath };
        const pagingOptions = { maxPageSize: 100 };
        const blobItems: BlobItem[] = [];

        for await (const page of this._containerClient.listBlobsFlat(listBlobsOptions).byPage(pagingOptions)) {
            page.segment.blobItems.forEach((blobItem: BlobItem) => {
                blobItems.push(blobItem);
            });
        }
        
        return blobItems;
    }

    private _convertBlobResultToArtifactItem(blobItems: BlobItem[]): models.ArtifactItem[] {
        const artifactItems: models.ArtifactItem[] = [];

        blobItems.forEach(item => {
            const artifactItem: models.ArtifactItem = new models.ArtifactItem();

            artifactItem.itemType = models.ItemType.File;
            artifactItem.fileLength = item.properties.contentLength;
            artifactItem.lastModified = new Date(item.properties.lastModified + 'Z');

            if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
                 // Supplying relative path without prefix; removing the first occurence
                artifactItem.path = item.name.replace(this._prefixFolderPath, "").trim();
            } else {
                artifactItem.path = item.name;
            }
            artifactItems.push(artifactItem);
        });

        return artifactItems;
    }

    private getStorageUrl(storageAccount: string): string {
        return `https://${storageAccount}.blob.core.windows.net`;
    }
}