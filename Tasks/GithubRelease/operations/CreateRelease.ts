import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import util = require("util");

export async function createRelease(): Promise<WebResponse> {

    // Get task inputs
    const repositoryName = tl.getInput('repositoryName');
    const tag = tl.getInput('tagCreate');
    const target = tl.getInput('target');
    const releaseTitle = tl.getInput('releaseTitle');        
    const isdraft = tl.getBoolInput('isdraft');
    const isprerelease = tl.getBoolInput('isprerelease');

    // Form request
    let request = new WebRequest();
    
    request.uri = util.format("%s/repos/%s/releases", Utility.getGitHubApiUrl(), repositoryName);
    request.method = "POST";
    request.body = JSON.stringify({
        "tag_name": tag || "defaultTag",
        "target_commitish": target || "master",
        "name": releaseTitle || tag || undefined,
        "body": Utility.getReleaseNote() || undefined,
        "draft": isdraft || false,
        "prerelease": isprerelease || false
    });
    request.headers = {
        "Content-Type": "application/json",
        'Authorization': 'token ' + Utility.getGithubEndPointToken()
    };
    tl.debug("Create release request:\n" + JSON.stringify(request, null, 2));

    // Send request
    return await sendRequest(request);
}