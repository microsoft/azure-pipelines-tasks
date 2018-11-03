import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import { GetReleaseByTag } from "./GetReleaseByTag";
import util = require("util");

export async function discardRelease(): Promise<WebResponse> {

    let releaseResponse = await GetReleaseByTag();

    if (releaseResponse.statusCode === 200) {
        // Get task inputs
        const repositoryName = tl.getInput('repositoryName');

        // Form request
        let request = new WebRequest();
        
        request.uri = util.format("%s/repos/%s/releases/%s", Utility.getGitHubApiUrl(), repositoryName, releaseResponse.body["id"]);
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + Utility.getGithubEndPointToken()
        };
        tl.debug("Discard release request:\n" + JSON.stringify(request, null, 2));

        // Send request
        return await sendRequest(request);
    }
    else {
        throw new Error(tl.loc("ErrorGettingReleaseByTag") + "\n" + JSON.stringify(releaseResponse));
    }

}