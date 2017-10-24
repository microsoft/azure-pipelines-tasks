import tl = require('vsts-task-lib/task');
import util = require("util");
import httpClient = require("typed-rest-client/HttpClient");
import httpInterfaces = require("typed-rest-client/Interfaces");

let proxyUrl: string = tl.getVariable("agent.proxyurl");
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
    proxy: {
        proxyUrl: proxyUrl,
        proxyUsername: tl.getVariable("agent.proxyusername"),
        proxyPassword: tl.getVariable("agent.proxypassword"),
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
    }
} : {};

let ignoreSslErrors: boolean = tl.getBoolInput("VSTS_ARM_REST_IGNORE_SSL_ERRORS", false);
requestOptions.ignoreSslError = ignoreSslErrors;

var httpCallbackClient = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);

export class WebRequest {
    public method: string;
    public uri: string;
    public body: string;
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
    let retryCount = options && options.retryCount ? options.retryCount : 5;
    let retryIntervalInSeconds = options && options.retryIntervalInSeconds ? options.retryIntervalInSeconds : 5;
    let retriableErrorCodes = options && options.retriableErrorCodes ? options.retriableErrorCodes : ["ETIMEDOUT"];

    while (true) {
        try {
            return await sendRequestInternal(request);
        }
        catch (error) {
            if (retriableErrorCodes.indexOf(error.code) != -1 && ++i < retryCount) {
                tl.debug(util.format("Encountered a retriable error:%s. Message: %s.", error.code, error.message));
                await sleepFor(retryIntervalInSeconds);
            }
            else {
                throw error;
            }
        }
    }
}

async function sendRequestInternal(request: WebRequest): Promise<WebResponse> {
    tl.debug(util.format("[%s]%s", request.method, request.uri));
    var response: httpClient.HttpClientResponse = await httpCallbackClient.request(request.method, request.uri, request.body, request.headers);
    return await toWebResponse(response);
}

async function toWebResponse(response: httpClient.HttpClientResponse): Promise<WebResponse> {
    var res = new WebResponse();
    if (response) {
        res.statusCode = response.message.statusCode;
        res.statusMessage = response.message.statusMessage;
        res.headers = response.message.headers;
        var body = await response.readBody();
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