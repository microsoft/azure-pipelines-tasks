import path = require('path');

import tl = require('vsts-task-lib/task');

import * as prca from './PRCA/PrcaOrchestrator';
import { PrcaOrchestrator } from './PRCA/PrcaOrchestrator';

import { TaskLibLogger } from './TaskLibLogger';

// Set up localization resource file
tl.setResourcePath(path.join( __dirname, 'task.json'));

var messageLimitInput:string = tl.getInput('messageLimit');
var messageLimit: number = Number(messageLimitInput);
if (isNaN(messageLimit)) {
    // Looks like: "Expected message limit to be a number, but instead it was NOT_A_NUMBER"
    tl.setResult(tl.TaskResult.Failed, tl.loc('Error_NotPullRequest', messageLimitInput));
}

var tlLogger: TaskLibLogger = new TaskLibLogger();
var collectionUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
var token: string = '';
var repositoryId: string = tl.getVariable('Build.Repository.Id');

var sourceBranch: string = tl.getVariable('build.sourceBranch');

// Do not continue if the build was not triggered by a pull request
if (!sourceBranch.startsWith('refs/pull/')) {
    // Looks like: "Skipping pull request commenting - this build was not triggered by a pull request."
    console.log(tl.loc('Error_NotPullRequest'));
} else {
    var pullRequestId: number = Number(sourceBranch.replace('refs/pull/', ''));
    if (isNaN(messageLimit)) {
        tl.debug(`Expected pull request ID to be a number. Actual: ${sourceBranch.replace('refs/pull/', '')}`);
        // Looks like: "Could not retrieve pull request ID from the server."
        tl.setResult(tl.TaskResult.Failed, tl.loc('Error_InvalidPullRequestId'));
    }

    var orchestrator:PrcaOrchestrator = PrcaOrchestrator.CreatePrcaOrchestrator(tlLogger, collectionUrl, token, repositoryId, pullRequestId);
    orchestrator.postSonarQubeIssuesToPullRequest(process.env)
        .then(() => {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc('Result_Success')); // Set task success
        })
        .catch(() => {
            tl.setResult(tl.TaskResult.Failed, tl.loc('Result_Fail')); // Set task failure
        });
}