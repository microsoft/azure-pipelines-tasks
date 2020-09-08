import msRestAzure = require("./azure-arm-common");
import webClient = require("./webClient");
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
export declare class ServiceClient {
    private credentials;
    protected apiVersion: string;
    protected baseUri: string;
    protected acceptLanguage: string;
    protected longRunningOperationRetryTimeout: number;
    protected generateClientRequestId: boolean;
    subscriptionId: string;
    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, timeout?: number);
    protected validateInputs(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string): void;
    getCredentials(): msRestAzure.ApplicationTokenCredentials;
    getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    getRequestUriForBaseUri(baseUri: string, uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string;
    setCustomHeaders(options: Object): {};
    beginRequest(request: webClient.WebRequest): Promise<webClient.WebResponse>;
    getLongRunningOperationResult(response: webClient.WebResponse, timeoutInMinutes?: number): Promise<webClient.WebResponse>;
    beginRequestExpBackoff(request: webClient.WebRequest, maxAttempt: number): Promise<webClient.WebResponse>;
    accumulateResultFromPagedResult(nextLinkUrl: string): Promise<ApiResult>;
    isValidResourceGroupName(resourceGroupName: string): void;
    isNameValid(name: string): boolean;
    getFormattedError(error: any): string;
    private sleepFor(sleepDurationInSeconds);
}
