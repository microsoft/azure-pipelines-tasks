import { BlockBlobClient } from '@azure/storage-blob'

import * as Url from "url";

export class AzureBlobUploadHelper {
    constructor(private debug: Function) {
    }

    public async upload(uploadUrl: string, zip: string): Promise<void> {
        const urlObject = Url.parse(uploadUrl);
        const [container, blob] = AzureBlobUploadHelper.getContainerAndBlob(urlObject);
        const blobClient = AzureBlobUploadHelper.getBlobClient(urlObject, container, blob);

        await this.uploadBlockBlob(blobClient, zip);
    }

    private uploadBlockBlob(blobClient: BlockBlobClient, file: string) {
        return blobClient.uploadFile(file, {
            blobHTTPHeaders: {
                blobContentType: "application/zip"
            }
        }).then(response => {
            if (response._response.status < 200 || response._response.status >= 300) {
                this.debug(`Failed to upload ZIP with symbols - ${blobClient.name}`);
                throw new Error(`Failed to upload file ${file} to blob ${blobClient.name}`);
            }
        });
    }

    private static getBlobClient(urlObject: Url.Url, container: string, blob: string): BlockBlobClient {
        const blobEndpoint = Url.format({
            protocol: urlObject.protocol,
            host: urlObject.host
        });
        const sharedAccessSignature = urlObject.query as string;

        const connectionString = "BlobEndpoint=" + blobEndpoint + ";" + "SharedAccessSignature=" + sharedAccessSignature;

        return new BlockBlobClient(connectionString, container, blob);
    }

    private static getContainerAndBlob(urlObject: Url.Url): [string, string] {
        const splitPathName = urlObject.pathname.split("/");
        return [splitPathName[1], splitPathName[2]];
    }
}
