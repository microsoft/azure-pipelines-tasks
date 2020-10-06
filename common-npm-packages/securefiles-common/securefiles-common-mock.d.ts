export declare class SecureFileHelpers {
    private static fileExtension;
    constructor(retryCount?: number);
    downloadSecureFile(secureFileId: string): Promise<string>;
    deleteSecureFile(secureFileId: string): void;
    static setFileExtension(extension: string): void;
}
