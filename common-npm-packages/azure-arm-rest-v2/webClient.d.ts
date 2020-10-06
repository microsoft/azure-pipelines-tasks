/// <reference types="node" />
export declare class WebRequest {
    method: string;
    uri: string;
    body: string | NodeJS.ReadableStream;
    headers: any;
}
export declare class WebResponse {
    statusCode: number;
    statusMessage: string;
    headers: any;
    body: any;
}
export declare class WebRequestOptions {
    retriableErrorCodes: string[];
    retryCount: number;
    retryIntervalInSeconds: number;
    retriableStatusCodes: number[];
    retryRequestTimedout: boolean;
}
export declare function sendRequest(request: WebRequest, options?: WebRequestOptions): Promise<WebResponse>;
export declare function sleepFor(sleepDurationInSeconds: any): Promise<any>;
