var path = require('path')
var url = require('url')

import * as tl from 'vsts-task-lib/task';
import * as models from "item-level-downloader/Models"
import * as engine from "item-level-downloader/Engine"
import * as providers from "item-level-downloader/Providers"
import {ArtifactDetailsDownloader} from "./ArtifactDetails/Downloader"

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function main(): Promise<void> {
    let connection = tl.getInput("connection", true);
    let jobId = tl.getInput("definition", true);
    let buildId = tl.getInput("version", true);
    let downloadPattern = tl.getInput("downloadPattern", true);
    let downloadPath = tl.getInput("downloadPath", true);

    var endpointUrl = tl.getEndpointUrl(connection, false);
    var itemsUrl = url.resolve(endpointUrl, "job/" + jobId + "/" + buildId + "/api/json?tree=artifacts[*]");
    console.log(tl.loc("DownloadArtifacts", itemsUrl));

    var variables = {
        "endpoint": {
            "url": endpointUrl
        },
        "definition": jobId,
        "version": buildId
    };
    
    var username = tl.getEndpointAuthorizationParameter(connection, 'username', false);
    var password = tl.getEndpointAuthorizationParameter(connection, 'password', false);
    var webProvider = new providers.WebProvider(itemsUrl, "jenkins.handlebars", username, password, variables);
    
    console.log('test1');
    let downloader = new engine.FetchEngine();
    console.log('test2');
    let downloaderOptions = new engine.FetchEngineOptions();
    console.log('test3');
    await downloader.fetchItems(webProvider, downloadPath, downloaderOptions);
    console.log('test4');
    tl.setResult(tl.TaskResult.Succeeded, "");
}

function AddIssue(message) {
    console.log(`##vso[task.logissue type=warning]${message}`);
}

main()
    .then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, error))
    .then(() => {
        let downloadCommitsAndWorkItems: boolean = tl.getBoolInput("downloadCommitsAndWorkItems", false);

        if (downloadCommitsAndWorkItems) {
            new ArtifactDetailsDownloader()
            .DownloadCommitsAndWorkItems()
            .then(
                () => console.log('Commits and WorkItems Downloaded successfully'), 
                (error) => AddIssue(`Downloading Jenkins Commits and WorkItem failed with an error: ${error}`));
        }
    });