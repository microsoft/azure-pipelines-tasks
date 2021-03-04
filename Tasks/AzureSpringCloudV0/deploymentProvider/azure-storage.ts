
import tl = require('azure-pipelines-task-lib/task');
import { ShareFileClient, AnonymousCredential } from '@azure/storage-file-share';

export class AzureStorage {
    public static async uploadFileToSasUrl(sasUrl: string, localPath: string) {
        tl.debug('uploading file to URL: ' + sasUrl);
        const shareFileClient = new ShareFileClient(sasUrl, new AnonymousCredential());
        try {
            console.info(`Starting upload of ${localPath}`);
            await shareFileClient.uploadFile(localPath, {
                onProgress: (ev) => console.log(ev)
            });
            console.info(`upload of ${localPath} completed`);
        } catch (err) {
            throw err;
        }
    }
}

