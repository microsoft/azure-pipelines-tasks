import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";

export async function createRelease(): Promise<WebResponse> {

    // Get task inputs
    const repositoryName = tl.getInput('repositoryName');
    const tag = tl.getInput('tagCreate');
    const target = tl.getInput('target');
    const releaseTitle = tl.getInput('releaseTitle');        
    const releasenote = tl.getInput('releasenote');
    const isdraft = tl.getBoolInput('isdraft');
    const isprerelease = tl.getBoolInput('isprerelease');

    // Form request
    let request = new WebRequest();
    
    request.uri = "https://api.github.com/repos/" + repositoryName + "/releases";
    request.method = "POST";
    request.body = JSON.stringify({
        "tag_name": tag || "defaultTag",
        "target_commitish": target || "master",
        "name": releaseTitle || tag || undefined,
        "body": releasenote || undefined,
        "draft": isdraft || false,
        "prerelease": isprerelease || false
    });
    request.headers = {
        "Content-Type": "application/json",
        'Authorization': 'token ' + Utility.getGithubEndPointToken(),
        'User-Agent': 'akbar-github-release create'
    };
    tl.debug("Create release request:\n" + JSON.stringify(request, null, 2));

    // Send request
    return await sendRequest(request);
}