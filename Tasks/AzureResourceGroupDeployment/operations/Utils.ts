import tl = require("vsts-task-lib/task");
import webClient = require("azure-arm-rest/webClient");

class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any) {
        if (error && error.message) {
            return error.message;
        }
        return error;
    }

    public static async getTargetUriFromFwdLink(fwdLink: string) {
        tl.debug("Trying to fetch target link from the fwdlink: " + fwdLink);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = fwdLink;
        var httpResponse = await webClient.sendRequest(httpRequest);
        var targetLink: string = httpResponse.headers.location;
        tl.debug("the target link is : " + targetLink);
        return targetLink;
    }
}

export = Utils;