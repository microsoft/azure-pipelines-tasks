import * as tl from "azure-pipelines-task-lib/task";

export class SecureFileHelpers {
    private static fileExtension: string = ".filename";

    constructor(retryCount?: number) {
        tl.debug('Mock SecureFileHelpers constructor');

        if (retryCount) {
            tl.debug('Mock SecureFileHelpers retry count set to: ' + retryCount);
        } else {
            tl.debug('Mock SecureFileHelpers retry count not set.');
        }
    }

    async downloadSecureFile(secureFileId: string) {
        tl.debug('Mock downloadSecureFile with id = ' + secureFileId);
        const fileName: string = `${secureFileId}${SecureFileHelpers.fileExtension}`;
        const tempDownloadPath: string = `/build/temp/${fileName}`;
        return tempDownloadPath;
    }

    deleteSecureFile(secureFileId: string) {
        tl.debug('Mock deleteSecureFile with id = ' + secureFileId);
    }

    static setFileExtension(extension: string): void {
        this.fileExtension = extension;
    }
}