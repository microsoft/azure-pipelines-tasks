
import tl = require('azure-pipelines-task-lib/task');
import { ShareFileClient, AnonymousCredential } from '@azure/storage-file-share';


export async function uploadFileToSasUrl(sasUrl: string, localPath: string) {
        tl.debug('uploading file to URL: ' + sasUrl);
        const shareFileClient = new ShareFileClient(sasUrl, new AnonymousCredential());
        try {
            console.info(tl.loc('StartingUploadOf', localPath));
            await shareFileClient.uploadFile(localPath, {
                onProgress: (ev) => console.log(ev)
            });
            console.info(tl.loc('CompletedUploadOf', localPath));
        } catch (err) {
            throw err;
        }
    }

