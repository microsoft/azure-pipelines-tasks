import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import util = require("util");

export async function GetReleaseByTag(): Promise<WebResponse> {

    // Get task inputs
    const repositoryName = tl.getInput('repositoryName') || undefined;
    const tag = tl.getInput('tagEdit') || undefined;

    tl.debug("tagEdit: " + tl.getInput("tagEdit"));

    // Form request
    let request = new WebRequest();
    
    request.uri = util.format("%s/repos/%s/releases/tags/%s", Utility.getGitHubApiUrl(), repositoryName, tag);
    request.method = "GET";
    request.headers = {
        'Authorization': 'token ' + Utility.getGithubEndPointToken()
    };
    tl.debug("Get release by tag request:\n" + JSON.stringify(request, null, 2));

    // Send request
    return await sendRequest(request);
}