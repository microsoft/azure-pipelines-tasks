import artifactProviders = require('artifact-engine/Providers');
import azureBlobProvider = require('./azureBlobStorageProvider');
import artifactProcessor = require('artifact-engine/Engine');

export class BlobService {
    private _storageAccountName: string;
    private _storageAccessKey: string;
    private _host: string;

    public constructor(storageAccountName: string, storageAccessKey: string, host?: string) {
        this._storageAccountName = storageAccountName;
        this._storageAccessKey = storageAccessKey;
        this._host = host;
    }

    public async downloadBlobs(destination: string, container: string, prefixFolderPath?: string, itemPattern?: string, addPrefixToDownloadedItems?: boolean): Promise<void> {
        var fileProvider = new artifactProviders.FilesystemProvider(destination);
        var azureProvider = new azureBlobProvider.AzureBlobProvider(this._storageAccountName, container, this._storageAccessKey, prefixFolderPath, this._host, !!addPrefixToDownloadedItems);
        var processor = new artifactProcessor.ArtifactEngine();
        var processorOptions = new artifactProcessor.ArtifactEngineOptions();
        if (itemPattern) {
            processorOptions.itemPattern = itemPattern;
        }

        await processor.processItems(azureProvider, fileProvider, processorOptions);
    }
}