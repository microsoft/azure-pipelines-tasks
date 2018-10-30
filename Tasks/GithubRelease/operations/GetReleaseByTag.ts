import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";

export async function GetReleaseByTag(): Promise<WebResponse> {

    // Get task inputs
    const repositoryName = tl.getInput('repositoryName') || undefined;
    const tag = tl.getInput('tagEdit') || undefined;

    tl.debug("tagEdit: " + tl.getInput("tagEdit"));

    // Form request
    let request = new WebRequest();
    
    request.uri = "https://api.github.com/repos/" + repositoryName + "/releases/tags/" + tag;
    request.method = "GET";
    request.headers = {
        'Authorization': 'token ' + Utility.getGithubEndPointToken(),
        'User-Agent': 'akbar-github-release create'
    };
    tl.debug("Get release by tag request:\n" + JSON.stringify(request, null, 2));

    // Send request
    return await sendRequest(request);
}