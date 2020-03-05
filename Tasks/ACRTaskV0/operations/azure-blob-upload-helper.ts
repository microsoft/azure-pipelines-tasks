import * as AzureStorage from "azure-storage";
import * as Url from "url";
import tl = require("azure-pipelines-task-lib/task");

export class AzureBlobUploadHelper {

  public async upload(uploadUrl: string, zip: string): Promise<void> {
    const urlObject = Url.parse(uploadUrl);
    const blobService = this.getBlobService(urlObject);
    const [container, blob] = this.getContainerAndBlob(urlObject);
    console.log(tl.loc("UploadSourceContext"));
    await this.uploadBlockBlob(blobService, container, blob, zip);
    console.log(tl.loc("BlobUploadSuccess", blob));
  }

  private uploadBlockBlob(blobService: AzureStorage.BlobService, container: string, blob: string, file: string): Promise<string> {
    return new Promise<string> ((resolve, reject) => {
      blobService.createBlockBlobFromLocalFile(container, blob, file, {
        contentSettings: {
          contentType: "application/tar+gzip"
        }
      }, (error, result, response) => {
        tl.debug("Response for upload source context to blob: " + JSON.stringify(response));
        if (error) {
          reject(new Error(tl.loc("FailedToUploadBlob", blob, error)));
        }
        else {
          resolve(JSON.stringify(response));
        }
      });
    });
  }

  private getBlobService(urlObject: Url.Url): AzureStorage.BlobService {
    const blobEndpoint = Url.format({
      protocol: urlObject.protocol,
      host: urlObject.host
    });

    const sharedAccessSignature = urlObject.query as string;
    const connectionString = "BlobEndpoint=" + blobEndpoint + ";" + "SharedAccessSignature=" + sharedAccessSignature;
    return new AzureStorage.BlobService(connectionString);
  }

  private getContainerAndBlob(urlObject: Url.Url): [string, string] {
    const splitPathName = urlObject.pathname.split("/");

    return [splitPathName[1], splitPathName[2] + "/" + splitPathName[3] + "/" + splitPathName[4]];
  }
}