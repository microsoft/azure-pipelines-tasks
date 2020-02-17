import tl = require("azure-pipelines-task-lib/task");
import webClient = require("./webClient");
const HttpRedirectCodes: number[] = [301, 302, 307, 308];
class WebRequestUtility {
    public static async getTargetUriFromFwdLink(fwdLink: string) {
        tl.debug("Trying to fetch target link from the fwdlink: " + fwdLink);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = fwdLink;
        var httpResponse = await webClient.sendRequest(httpRequest);
        if(HttpRedirectCodes.indexOf(httpResponse.statusCode) == -1) {
            throw new Error(tl.loc('ARG_RedirectResponseInvalidStatusCode', httpResponse.statusCode)); 
        }
        var targetLink: string = httpResponse.headers["location"];
        if(!targetLink) {
            throw new Error(tl.loc('ARG_RedirectResponseLocationHeaderIsNull', httpResponse.statusCode));
        }
        tl.debug("the target link is : " + targetLink);
        return targetLink;
    }
}

export = WebRequestUtility;