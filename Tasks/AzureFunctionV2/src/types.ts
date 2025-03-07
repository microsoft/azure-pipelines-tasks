import { AxiosRequestConfig } from 'axios';
import { AuthType, HttpMethod, CompletionEvent } from './constants';

export interface TaskInputs {
    authType: AuthType;
    serviceConnection?: string;    // ARM service connection (required for ARM auth)
    function: string;              // Azure function URL
    key?: string;                  // Function key (required for key auth)
    method: HttpMethod;            // HTTP method
    headers: Record<string, string>;
    queryParameters?: string;
    body?: string;
    waitForCompletion: CompletionEvent;
    successCriteria?: string;
}

export interface FunctionRequest {
    url: string;
    config: AxiosRequestConfig;
}

export interface CallbackResult {
    statusCode: number;
    body: any;
}

export interface AzureEndpoint {
    subscriptionID: string;
    subscriptionName: string;
    servicePrincipalClientID: string;
    servicePrincipalKey?: string;
    tenantID: string;
    url: string;
    environmentAuthorityUrl: string;
    activeDirectoryResourceID: string;
    scheme: string; // Authentication scheme (ServicePrincipal, WorkloadIdentityFederation, etc.)
    applicationTokenCredentials: any; // Contains getToken() method
}