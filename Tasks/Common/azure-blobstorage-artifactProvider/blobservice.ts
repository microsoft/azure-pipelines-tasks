import artifactProviders = require('item-level-downloader/Providers');
import azureBlobProvider = require('./azureBlobStorageProvider');
import artifactProcessor = require('item-level-downloader/Engine');
import path = require('path');
import util = require('util');

export class BlobService {
    private _storageAccountName: string;
    private _storageAccessKey: string;

    public constructor(storageAccountName: string, storageAccessKey: string) {
        this._storageAccountName = storageAccountName;
        this._storageAccessKey = storageAccessKey;
    }

    public async uploadBlobs(source: string, container: string, prefixFolderPath?: string, host?: string): Promise<void> {
        var fileProvider = new artifactProviders.FilesystemProvider(source);
        var azureProvider = new azureBlobProvider.AzureBlobProvider(this._storageAccountName, container, this._storageAccessKey, prefixFolderPath, host);
        var processor = new artifactProcessor.ArtifactEngine();
        await processor.processItems(fileProvider, azureProvider);
    }

    public async downloadBlobs(destination: string, container: string, prefixFolderPath?: string, host?: string): Promise<void> {
        var fileProvider = new artifactProviders.FilesystemProvider(destination);
        var azureProvider = new azureBlobProvider.AzureBlobProvider(this._storageAccountName, container, this._storageAccessKey, prefixFolderPath, host);
        var processor = new artifactProcessor.ArtifactEngine();
        await processor.processItems(azureProvider, fileProvider);
    }
}