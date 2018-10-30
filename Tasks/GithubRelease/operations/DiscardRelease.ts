import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import { GetReleaseByTag } from "./GetReleaseByTag";

export async function DiscardRelease(): Promise<WebResponse> {

    let releaseResponse = await GetReleaseByTag();

    if (releaseResponse.statusCode === 200) {
        // Get task inputs
        const repositoryName = tl.getInput('repositoryName');

        // Form request
        let request = new WebRequest();
        
        request.uri = "https://api.github.com/repos/" + repositoryName + "/releases/" + releaseResponse.body["id"];
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + Utility.getGithubEndPointToken(),
            'User-Agent': 'akbar-github-release delete'
        };
        tl.debug("Discard release request:\n" + JSON.stringify(request, null, 2));

        // Send request
        return await sendRequest(request);
    }
    else {
        throw new Error(tl.loc("ErrorGettingReleaseByTag") + "\n" + JSON.stringify(releaseResponse));
    }

}