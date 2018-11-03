import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import { GetReleaseByTag } from "./GetReleaseByTag";
import util = require("util");

export async function editRelease(): Promise<WebResponse> {

    let releaseResponse = await GetReleaseByTag();

    if (releaseResponse.statusCode === 200) {
        // Get task inputs
        const repositoryName = tl.getInput('repositoryName');
        const tag = tl.getInput('tagEdit');
        const releaseTitle = tl.getInput('releaseTitle');        
        const isdraft = tl.getBoolInput('isdraft');
        const isprerelease = tl.getBoolInput('isprerelease');

        // Form request
        let request = new WebRequest();
        
        request.uri = util.format("%s/repos/%s/releases/%s", Utility.getGitHubApiUrl(), repositoryName, releaseResponse.body["id"]);
        request.method = "PATCH";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": undefined,
            "name": releaseTitle || undefined,
            "body": Utility.getReleaseNote() || undefined,
            "draft": isdraft || false,
            "prerelease": isprerelease || false
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + Utility.getGithubEndPointToken()
        };
        tl.debug("Edit release request:\n" + JSON.stringify(request, null, 2));

        // Send request
        return await sendRequest(request);
    }
    else {
        throw new Error(tl.loc("ErrorGettingReleaseByTag") + "\n" + JSON.stringify(releaseResponse));
    }

}