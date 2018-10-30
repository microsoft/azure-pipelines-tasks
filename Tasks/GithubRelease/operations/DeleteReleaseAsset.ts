import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";

export async function deleteReleaseAsset(asset_id: string): Promise<WebResponse> {
    const repositoryName = tl.getInput('repositoryName');

    // Form request
    let request = new WebRequest();
    
    request.uri = "https://api.github.com/repos/" + repositoryName + "/releases/assets/" + asset_id;
    request.method = "DELETE";
    request.headers = {
        'Authorization': 'token ' + Utility.getGithubEndPointToken(),
        'User-Agent': 'akbar-github-release delte release asset'
    };
    tl.debug("Delete release asset request:\n" + JSON.stringify(request, null, 2));

    // Send request
    return await sendRequest(request);
}