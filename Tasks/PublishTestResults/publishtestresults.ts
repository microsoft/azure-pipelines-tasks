import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as publishExe from './PublishResultsThroughExe';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as vsts from 'vso-node-api';


async function isPublishThroughExeFeatureFlagEnabled(): Promise<boolean> {
    let collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');

    let token: string = tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false);

    try {
        let authHandler = vsts.getPersonalAccessTokenHandler(token);
        let connection = new vsts.WebApi(collectionUrl, authHandler);

        if (typeof connection["getFeatureAvailabilityApi"] === 'function') {
            let vstsFeatureAvailability = connection["getFeatureAvailabilityApi"]();

            let featureFlag = await vstsFeatureAvailability.getFeatureFlagByName("TestManagement.PublishTestResultsTask.UseTestResultsPublisherExe");
            if (featureFlag) {
                tl.debug("Feature flag effective state: " + featureFlag.effectiveState);
                if (featureFlag.effectiveState === "On") {
                    return true;
                }
            }
        }
    }
    catch (err) {
        tl.debug("Error while fetching Feature flag value: " + err);
    }
    return false;
}

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const testRunner = tl.getInput('testRunner', true);
        const testResultsFiles: string[] = tl.getDelimitedInput('testResultsFiles', '\n', true);
        const mergeResults = tl.getInput('mergeTestResults');
        const platform = tl.getInput('platform');
        const config = tl.getInput('configuration');
        const testRunTitle = tl.getInput('testRunTitle');
        const publishRunAttachments = tl.getInput('publishRunAttachments');
        let searchFolder = tl.getInput('searchFolder');

        tl.debug('testRunner: ' + testRunner);
        tl.debug('testResultsFiles: ' + testResultsFiles);
        tl.debug('mergeResults: ' + mergeResults);
        tl.debug('platform: ' + platform);
        tl.debug('config: ' + config);
        tl.debug('testRunTitle: ' + testRunTitle);
        tl.debug('publishRunAttachments: ' + publishRunAttachments);


        if (isNullOrWhitespace(searchFolder)) {
            searchFolder = tl.getVariable('System.DefaultWorkingDirectory');
        }
        let matchingTestResultsFiles: string[] = tl.findMatch(searchFolder, testResultsFiles);
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            tl.warning(tl.loc('NoMatchingFilesFound', testResultsFiles));
        }
        else {
            let osType = tl.osType();
            // Enable this when Feature availability APIs are available.
            // let isPublishResultsThroughExeEnabled: boolean = await isPublishThroughExeFeatureFlagEnabled();

            tl.debug('OS type: ' + osType);

            if (osType === 'Windows_NT') {
                let testResultsPublisher = new publishExe.TestResultsPublisher(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments, testRunner);
                let exitCode = await testResultsPublisher.publishResultsThroughExe();
                tl.debug("Exit code of TestResultsPublisher: " + exitCode);

                if (exitCode == 1) {
                    let tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
                    tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
                }                
            }
            else {
                let tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
                tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
            }
        }

        tl.setResult(tl.TaskResult.Succeeded, '');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();