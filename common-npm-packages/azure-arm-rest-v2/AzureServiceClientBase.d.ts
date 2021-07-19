import msRestAzure = require("./azure-arm-common");
import webClient = require("./webClient");
import { DeploymentsBase } from './DeploymentsBase';
export declare class ApiResult {
    error: any;
    result: any;
    request: any;
    response: any;
    constructor(error: any, result?: any, request?: any, response?: any);
}
export declare class AzureError {
    code: any;
    message: any;
    statusCode: any;
    details: any;
}
export interface ApiCallback {
    (error: any, result?: any, request?: any, response?: any): void;
}
export declare function ToError(response: webClient.WebResponse): AzureError;
export declare class AzureServiceClientBase {
    deployments: DeploymentsBase;
    protected credentials: msRestAzure.ApplicationTokenCredentials;
    protected apiVersion: string;
    protected baseUri: string;
    protected acceptLanguage: string;
    protected longRunningOperationRetryTimeout: number;
    protected generateClientRequestId: boolean;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, timeout?: number);
    getCredentials(): msRestAzure.ApplicationTokenCredentials;
    getRequestUriForBaseUri(baseUri: string, uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    setCustomHeaders(options: Object): {};
    beginRequest(request: webClient.WebRequest): Promise<webClient.WebResponse>;
    getLongRunningOperationResult(response: webClient.WebResponse, timeoutInMinutes?: number): Promise<webClient.WebResponse>;
    beginRequestExpBackoff(request: webClient.WebRequest, maxAttempt: number): Promise<webClient.WebResponse>;
    accumulateResultFromPagedResult(nextLinkUrl: string): Promise<ApiResult>;
    isNameValid(name: string): boolean;
    getFormattedError(error: any): string;
    protected validateCredentials(credentials: msRestAzure.ApplicationTokenCredentials): void;
    protected getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    private sleepFor(sleepDurationInSeconds);
}
