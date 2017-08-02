import tl = require('vsts-task-lib/task');
import * as definitions from "./definitions";
import BlobService from './blobService';

export function createBlobService(storageAccountName: string, storageAccessKey: string) {
    return new BlobService(storageAccountName, storageAccessKey);
}