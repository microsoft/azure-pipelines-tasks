import path = require("path");
import util = require('util');
import * as BlobService from './blobservice';

var config = require("./config.json");

export class Demo {

  main() {
    var blobService = new BlobService.BlobService(config.azureblobstorage.storageAccountName, config.azureblobstorage.storageAccessKey);
    blobService.downloadBlobs(config.dropLocation , config.azureblobstorage.sourceContainerName);
    blobService.uploadBlobs(config.dropLocation , config.azureblobstorage.destinationContainerName, "ManualTest/uploadHere")
  }
}

new Demo().main();