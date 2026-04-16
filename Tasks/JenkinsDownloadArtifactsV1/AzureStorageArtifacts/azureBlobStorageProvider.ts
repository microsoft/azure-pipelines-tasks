import path = require('path');
import { BlobServiceClient, StorageSharedKeyCredential, ContainerClient } from '@azure/storage-blob';
import fs = require('fs');
import models = require('artifact-engine/Models');
import store = require('artifact-engine/Store');
import * as tl from 'azure-pipelines-task-lib/task';
import { Readable } from 'stream';

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
        
        const sharedKeyCredential = new StorageSharedKeyCredential(storageAccount, accessKey);
        const blobEndpoint = host || `https://${storageAccount}.blob.core.windows.net`;
        const blobServiceClient = new BlobServiceClient(blobEndpoint, sharedKeyCredential);
        this._containerClient = blobServiceClient.getContainerClient(container);
        this._addPrefixToDownloadedItems = !!addPrefixToDownloadedItems;
    }

    public async putArtifactItem(item: models.ArtifactItem, readStream: NodeJS.ReadableStream): Promise<models.ArtifactItem> {
        await this._ensureContainerExistence();

        console.log(tl.loc("UploadingItem", item.path));
        var blobPath = this._prefixFolderPath ? this._prefixFolderPath + "/" + item.path : item.path;

        try {
            const blockBlobClient = this._containerClient.getBlockBlobClient(blobPath);
            await blockBlobClient.uploadStream(readStream as Readable);
            
            var blobUrl = blockBlobClient.url;
            console.log(tl.loc("CreatedBlobForItem", item.path, blobUrl));
            item.metadata["destinationUrl"] = blobUrl;
            return item;
        } catch (error) {
            console.log(tl.loc("FailedToUploadBlob", blobPath, error.message));
            throw error;
        }
    }

    public getRootItems(): Promise<models.ArtifactItem[]> {
        return this._getItems(this._container, this._prefixFolderPath);
    }

    public getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        throw new Error(tl.loc("GetArtifactItemsNotSupported"));
    }

    public async getArtifactItem(artifactItem: models.ArtifactItem): Promise<NodeJS.ReadableStream> {
        let blobPath: string;
        if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
            blobPath = this._prefixFolderPath + artifactItem.path;
        } else {
            blobPath = artifactItem.path;
        }
        
        const blobClient = this._containerClient.getBlobClient(blobPath);
        const downloadResponse = await blobClient.download(0);
        return downloadResponse.readableStreamBody as NodeJS.ReadableStream;
    }

    public dispose() {
    }

    private async _ensureContainerExistence(): Promise<void> {
        if (!this._containerExists) {
            try {
                await this._containerClient.createIfNotExists();
                this._containerExists = true;
                console.log(tl.loc("CreatedContainer", this._container));
            } catch (error) {
                console.log(tl.loc("FailedToCreateContainer", this._container, error.message));
                throw error;
            }
        }
    }

    private async _getItems(container: string, parentRelativePath?: string): Promise<models.ArtifactItem[]> {
        var items: models.ArtifactItem[] = [];
        
        const listOptions = parentRelativePath ? { prefix: parentRelativePath } : {};
        
        for await (const blob of this._containerClient.listBlobsFlat(listOptions)) {
            var artifactitem: models.ArtifactItem = new models.ArtifactItem();
            artifactitem.itemType = models.ItemType.File;
            artifactitem.fileLength = blob.properties.contentLength || 0;
            artifactitem.lastModified = blob.properties.lastModified || new Date();
            
            if (!this._addPrefixToDownloadedItems && !!this._prefixFolderPath) {
                artifactitem.path = blob.name.replace(this._prefixFolderPath, "").trim();
            } else {
                artifactitem.path = blob.name;
            }
            items.push(artifactitem);
        }

        console.log(tl.loc("SuccessFullyFetchedItemList"));
        return items;
    }

    private _storageAccount: string;
    private _accessKey: string;
    private _container: string;
    private _prefixFolderPath: string;
    private _containerExists: boolean = false;
    private _containerClient: ContainerClient;
    private _addPrefixToDownloadedItems: boolean = false;
}