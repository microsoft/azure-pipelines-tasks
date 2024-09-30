import * as BlobService from './blobservice';

var config = require("./config.json");

export class Demo {

  async main() {
    var blobService = new BlobService.BlobService(config.azureblobstorage.storageAccountName, config.azureblobstorage.storageAccessKey);
    await blobService.downloadBlobs(config.dropLocation, config.azureblobstorage.sourceContainerName, "v17");
    var uploadedUrls = await blobService.uploadBlobs(config.dropLocation, config.azureblobstorage.destinationContainerName, "ManualTest/uploadHere")
    console.log("####### Uploaded urls start ########")
    uploadedUrls.forEach((url: string) => {
      console.log(url);
    })

    console.log("####### Uploaded urls end ########")
  }
}

new Demo().main();