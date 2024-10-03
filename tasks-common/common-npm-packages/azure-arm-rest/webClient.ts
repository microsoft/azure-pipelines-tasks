import tl = require('azure-pipelines-task-lib/task');
import util = require("util");
import fs = require('fs');
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
} : {
    allowRedirects: false,
    keepAlive: true
};

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";

var azureHttpUserAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");

export class WebRequest {
    public method: string;
    public uri: string;
    // body can be string or ReadableStream
    public body: string | NodeJS.ReadableStream;
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
    public retriableStatusCodes: number[];
    public retryRequestTimedout: boolean;
}

export async function sendRequest(request: WebRequest, options?: WebRequestOptions): Promise<WebResponse> {
    let i = 0;
    let retryCount = options && options.retryCount ? options.retryCount : 5;
    let retryIntervalInSeconds = options && options.retryIntervalInSeconds ? options.retryIntervalInSeconds : 2;
    let retriableErrorCodes = options && options.retriableErrorCodes ? options.retriableErrorCodes : ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ESOCKETTIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "EPIPE", "EA_AGAIN"];
    let retriableStatusCodes = options && options.retriableStatusCodes ? options.retriableStatusCodes : [408, 409, 500, 502, 503, 504];
    let timeToWait: number = retryIntervalInSeconds;

    // reset stream on retry even request's body is readable (possible fix for connection reset on large deployments)
    const rawResetStreamOnRetry = tl.getVariable("CLIENT_RESETSTREAMONRETRY");
    let resetStreamOnRetry: boolean = false;
    if (rawResetStreamOnRetry) {
        try {
            tl.debug(`WEBCLIENT - CLIENT_RESETSTREAMONRETRY override is found: ${rawResetStreamOnRetry}`);
            const parsedResetStreamOnRetry = JSON.parse(rawResetStreamOnRetry);
            if (typeof parsedResetStreamOnRetry !== "boolean") {
                throw new Error("Value is not a boolean");
            }
            resetStreamOnRetry = parsedResetStreamOnRetry;
        } catch (error) {
            // this is not a blocker error, so we're informing
            tl.debug(`WEBCLIENT - CLIENT_RESETSTREAMONRETRY override is found couldn't be parsed due to error ${error}. resetStreamOnRetry=${resetStreamOnRetry} is used instead`);
        }
    }

    while (true) {
        try {
            if (request.body && typeof (request.body) !== 'string' && (resetStreamOnRetry || !request.body["readable"])) {
                tl.debug(`WEBCLIENT - request body stream is reset due to the reason : ${resetStreamOnRetry ? 'resetStreamOnRetry is set.' : 'request body is not readable.'}`);
                request.body = fs.createReadStream(request.body["path"]);
            }

            let response: WebResponse = await sendRequestInternal(request);
            if (retriableStatusCodes.indexOf(response.statusCode) != -1 && ++i < retryCount) {
                tl.debug(util.format("Encountered a retriable status code: %s. Message: '%s'.", response.statusCode, response.statusMessage));
                await sleepFor(timeToWait);
                timeToWait = timeToWait * retryIntervalInSeconds + retryIntervalInSeconds;
                continue;
            }

            return response;
        }
        catch (error) {
            if (retriableErrorCodes.indexOf(error.code) != -1 && ++i < retryCount) {
                tl.debug(util.format("Encountered a retriable error:%s. Message: %s.", error.code, error.message));
                await sleepFor(timeToWait);
                timeToWait = timeToWait * retryIntervalInSeconds + retryIntervalInSeconds;
            }
            else {
                if (error.code) {
                    console.log("##vso[task.logissue type=error;code=" + error.code + ";]");
                }

                throw error;
            }
        }
    }
}

export function sleepFor(sleepDurationInSeconds): Promise<any> {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, sleepDurationInSeconds * 1000);
    });
}

async function sendRequestInternal(request: WebRequest): Promise<WebResponse> {
    tl.debug(util.format("[%s]%s", request.method, request.uri));
    var httpCallbackClient = new httpClient.HttpClient(azureHttpUserAgent, null, requestOptions);
    
    var response: httpClient.HttpClientResponse = await httpCallbackClient.request(request.method, request.uri, request.body, request.headers);
    const weResponse = await toWebResponse(response);
    
    httpCallbackClient.dispose();
    return weResponse;
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
                tl.debug("Could not parse response: " + JSON.stringify(error));
                tl.debug("Response: " + JSON.stringify(res.body));
                res.body = body;
            }
        }
    }

    return res;
}
