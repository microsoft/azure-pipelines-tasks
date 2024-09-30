import { WebApi } from 'azure-devops-node-api';
export declare class SecureFileHelpers {
    serverConnection: WebApi;
    constructor(retryCount?: number);
    /**
     * Download secure file contents to a temporary location for the build
     * @param secureFileId
     */
    downloadSecureFile(secureFileId: string): Promise<string>;
    /**
     * Delete secure file from the temporary location for the build
     * @param secureFileId
     */
    deleteSecureFile(secureFileId: string): void;
    /**
     * Returns the temporary download location for the secure file
     * @param secureFileId
     */
    getSecureFileTempDownloadPath(secureFileId: string): string;
}
