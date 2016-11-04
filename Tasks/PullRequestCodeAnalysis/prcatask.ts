/// <reference path="./typings/index.d.ts" />

import path = require('path');

import tl = require('vsts-task-lib/task');

import * as prca from './PRCA/PrcaOrchestrator';
import { PrcaOrchestrator } from './PRCA/PrcaOrchestrator';

import { TaskLibLogger } from './TaskLibLogger';

// Set up localization resource file
tl.setResourcePath(path.join( __dirname, 'task.json'));


var sourceBranch: string = tl.getVariable('Build.SourceBranch');

// Do nothing (except log a message) if the build was not triggered by a pull request
if (!sourceBranch.startsWith('refs/pull/')) {
    // Looks like: "Skipping pull request commenting - this build was not triggered by a pull request."
    console.log(tl.loc('Error_NotPullRequest'));
} else {

    var messageLimitInput:string = tl.getInput('messageLimit');
    var messageLimit: number = Number(messageLimitInput);
    if (isNaN(messageLimit)) {
        // Looks like: "Expected message limit to be a number, but instead it was NOT_A_NUMBER"
        tl.setResult(tl.TaskResult.Failed, tl.loc('Error_InvalidMessageLimit', messageLimitInput));
    }

    var tlLogger: TaskLibLogger = new TaskLibLogger();
    var collectionUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
    var repositoryId: string = tl.getVariable('Build.Repository.Id');

    // Get authentication from the agent itself
    let token = "";
    var auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme !== "OAuth") {
        // We cannot get the access token, fail the task
        tl.error(tl.loc('Error_FailedToGetAuthToken'));
        tl.setResult(tl.TaskResult.Failed, tl.loc('Info_ResultFail')); // Set task failure
    }

    token = auth.parameters["AccessToken"];
    var pullRequestId: number = Number.parseInt(sourceBranch.replace('refs/pull/', ''));
    if (isNaN(pullRequestId)) {
        tl.debug(`Expected pull request ID to be a number. Attempted to parse: ${sourceBranch.replace('refs/pull/', '')}`);
        // Looks like: "Could not retrieve pull request ID from the server."
        tl.setResult(tl.TaskResult.Failed, tl.loc('Error_InvalidPullRequestId'));
    }

    var orchestrator:PrcaOrchestrator = PrcaOrchestrator.CreatePrcaOrchestrator(tlLogger, collectionUrl, token, repositoryId, pullRequestId);
    orchestrator.postSonarQubeIssuesToPullRequest(tl.getVariable('PRCA_REPORT_PATH'))
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('Info_ResultSuccess')); // Set task success
        })
        .catch((error:any) => {
            tlLogger.LogDebug(`Task failed with the following error: ${error}`);
            tl.setResult(tl.TaskResult.Failed, tl.loc('Info_ResultFail')); // Set task failure
        });
}