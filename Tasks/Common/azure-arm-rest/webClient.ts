import tl = require('vsts-task-lib/task');
import util = require("util")
var httpClient = require('vso-node-api/HttpClient');
var httpCallbackClient = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

export class WebRequest {
    public method: string;
    public uri: string;
    public body: any;
    public headers: any;
}

export class WebResponse {
    public statusCode: number;
    public statusMessage: string;
    public headers: any;
    public body: any;
}

export class WebRequestOptions {
    public retriableErrorCodes: string[];
    public retryCount: number;
    public retryIntervalInSeconds: number;
}

export async function sendRequest(request: WebRequest, options?: WebRequestOptions): Promise<WebResponse> {
    let i = 0;
    let retryCount = options ? options.retryCount : 5;
    let retryIntervalInSeconds = options ? options.retryIntervalInSeconds : 5;
    let retriableErrorCodes = options ? options.retriableErrorCodes : ["ETIMEDOUT"];

    while (true) {
        try {
            return await sendReqeustInternal(request);
        }
        catch (error) {
            if (retriableErrorCodes && retriableErrorCodes.indexOf(error.code) != -1 && ++i < retryCount) {
                await sleepFor(retryIntervalInSeconds);
            }
            else {
                throw error;
            }
        }
    }
}

function sendReqeustInternal(request: WebRequest): Promise<WebResponse> {
    tl.debug(util.format("[%s]%s", request.method, request.uri));
    return new Promise<WebResponse>((resolve, reject) => {
        httpCallbackClient.send(request.method, request.uri, request.body, request.headers, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else {
                var httpResponse = toWebResponse(response, body);
                resolve(httpResponse);
            }
        });
    });
}

function toWebResponse(response, body): WebResponse {
    var res = new WebResponse();

    if (response) {
        res.statusCode = response.statusCode;
        res.statusMessage = response.statusMessage;
        res.headers = response.headers;
        if (body) {
            try {
                res.body = JSON.parse(body);
            }
            catch (error) {
                res.body = body;
            }
        }
    }
    return res;
}

function sleepFor(sleepDurationInSeconds): Promise<any> {
    return new Promise((resolve, reeject) => {
        setTimeout(resolve, sleepDurationInSeconds * 1000);
    });
}