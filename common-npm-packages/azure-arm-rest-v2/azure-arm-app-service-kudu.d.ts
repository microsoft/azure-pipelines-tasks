import webClient = require('./webClient');
import { WebJob, SiteExtension } from './azureModels';
export declare class KuduServiceManagementClient {
    private _scmUri;
    private _accesssToken;
    private _cookie;
    constructor(scmUri: string, accessToken: string);
    beginRequest(request: webClient.WebRequest, reqOptions?: webClient.WebRequestOptions): Promise<webClient.WebResponse>;
    getRequestUri(uriFormat: string, queryParameters?: Array<string>): string;
    getScmUri(): string;
}
export declare class Kudu {
    private _client;
    constructor(scmUri: string, username: string, password: string);
    updateDeployment(requestBody: any): Promise<string>;
    getContinuousJobs(): Promise<Array<WebJob>>;
    startContinuousWebJob(jobName: string): Promise<WebJob>;
    stopContinuousWebJob(jobName: string): Promise<WebJob>;
    installSiteExtension(extensionID: string): Promise<SiteExtension>;
    getSiteExtensions(): Promise<Array<SiteExtension>>;
    getAllSiteExtensions(): Promise<Array<SiteExtension>>;
    getProcess(processID: number): Promise<any>;
    killProcess(processID: number): Promise<void>;
    getAppSettings(): Promise<Map<string, string>>;
    listDir(physicalPath: string): Promise<void>;
    getFileContent(physicalPath: string, fileName: string): Promise<string>;
    uploadFile(physicalPath: string, fileName: string, filePath: string): Promise<void>;
    createPath(physicalPath: string): Promise<any>;
    runCommand(physicalPath: string, command: string): Promise<void>;
    extractZIP(webPackage: string, physicalPath: string): Promise<void>;
    zipDeploy(webPackage: string, queryParameters?: Array<string>): Promise<any>;
    warDeploy(webPackage: string, queryParameters?: Array<string>): Promise<any>;
    getDeploymentDetails(deploymentID: string): Promise<any>;
    getDeploymentLogs(log_url: string): Promise<any>;
    deleteFile(physicalPath: string, fileName: string): Promise<void>;
    deleteFolder(physicalPath: string): Promise<void>;
    private _getDeploymentDetailsFromPollURL(pollURL);
    private _getFormattedError(error);
}
