const { BlobServiceClient } = require("@azure/storage-blob");
import * as Url from "url";
import { inspect } from "util";

export class AzureBlobUploadHelper {
    constructor(private debug: Function) {
    }

    public async upload(uploadUrl: string, zip: string): Promise<void> {
        const urlObject = Url.parse(uploadUrl);
        const blobService = this.getBlobService(urlObject);
        const [container, blob] = this.getContainerAndBlob(urlObject);

        await this.uploadBlockBlob(blobService, container, blob, zip);
    }

    private uploadBlockBlob(blobService: any, container: string, blob: string, file: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            blobService.createBlockBlobFromLocalFile(container, blob, file, {
                contentSettings: {
                    contentType: "application/zip"
                }
            }, (error, result, response) => {
                if (error) {
                    this.debug(`Failed to upload ZIP with symbols - ${inspect(error)}`);
                    reject(new Error("failed to upload ZIP with symbols"));
                } else {
                    resolve();
                }
            });
        });
    }

    private getBlobService(urlObject: Url.Url) {
        const blobEndpoint = Url.format({
            protocol: urlObject.protocol,
            host: urlObject.host
        });
        const sharedAccessSignature = urlObject.query as string;

        const connectionString = "BlobEndpoint=" + blobEndpoint + ";" + "SharedAccessSignature=" + sharedAccessSignature;

        return BlobServiceClient.fromConnectionString(connectionString);
    }

    private getContainerAndBlob(urlObject: Url.Url): [string, string] {
        const splitPathName = urlObject.pathname.split("/");
        return [splitPathName[1], splitPathName[2]];
    }
}