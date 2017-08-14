import * as artifactProviders from 'artifact-mover/Providers';
import * as artifactProcessor from 'artifact-mover/Engine';
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

    public async uploadBlobs(source: string, container: string): Promise<void> {
        var fileProvider = new artifactProviders.LocalFilesystemProvider(source);
        var azureProvider = new artifactProviders.AzureBlobProvider(this._storageAccountName, container,this._storageAccessKey);
        var processor = new artifactProcessor.ArtifactEngine();
        await processor.processItems(fileProvider, azureProvider);
    }
}