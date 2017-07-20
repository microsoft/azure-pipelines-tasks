import tl = require('vsts-task-lib/task');
import * as definitions from "./definitions";
import { AzCopyXplat } from "./azure-blob-transfer";

//var _client: definitions.IBlobTransferService;

export function createBlobTransferService(): definitions.IBlobTransferService {
    // if(this._client) {
    //     return this._client;
    // } else {
        if(tl.osType().match(/^Win/)) {
            return new AzCopyXplat();
        } else {
            return new AzCopyXplat();
        }
    //}
}