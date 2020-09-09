export declare class KuduTests {
    static updateDeployment(): Promise<void>;
    static getContinuousJobs(): Promise<void>;
    static startContinuousWebJob(): Promise<void>;
    static stopContinuousWebJob(): Promise<void>;
    static installSiteExtension(): Promise<void>;
    static getSiteExtensions(): Promise<void>;
    static getAllSiteExtensions(): Promise<void>;
    static getProcess(): Promise<void>;
    static killProcess(): Promise<void>;
    static getAppSettings(): Promise<void>;
    static listDir(): Promise<void>;
    static getFileContent(): Promise<void>;
    static uploadFile(): Promise<void>;
    static createPath(): Promise<void>;
    static runCommand(): Promise<void>;
    static extractZIP(): Promise<void>;
    static zipDeploy(): Promise<void>;
    static deleteFile(): Promise<void>;
}
