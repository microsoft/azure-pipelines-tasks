import tl = require("vsts-task-lib/task");
import { WebRequest, sendRequest, WebResponse } from "./webClient";
import * as Utility from "./Utility";
import { GetReleaseByTag } from "./GetReleaseByTag";

export async function EditRelease(): Promise<WebResponse> {

    let releaseResponse = await GetReleaseByTag();

    if (releaseResponse.statusCode === 200) {
        // Get task inputs
        const repositoryName = tl.getInput('repositoryName');
        const tag = tl.getInput('tagEdit');
        const target = tl.getInput('target');
        const releaseTitle = tl.getInput('releaseTitle');        
        const releasenote = tl.getInput('releasenote');
        const isdraft = tl.getBoolInput('isdraft');
        const isprerelease = tl.getBoolInput('isprerelease');

        // Form request
        let request = new WebRequest();
        
        request.uri = "https://api.github.com/repos/" + repositoryName + "/releases/" + releaseResponse.body["id"];
        request.method = "PATCH";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": undefined,
            "name": releaseTitle || undefined,
            "body": releasenote || undefined,
            "draft": isdraft || false,
            "prerelease": isprerelease || false
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + Utility.getGithubEndPointToken(),
            'User-Agent': 'akbar-github-release edit'
        };
        tl.debug("Edit release request:\n" + JSON.stringify(request, null, 2));

        // Send request
        return await sendRequest(request);
    }
    else {
        throw new Error(tl.loc("ErrorGettingReleaseByTag") + "\n" + JSON.stringify(releaseResponse));
    }

}