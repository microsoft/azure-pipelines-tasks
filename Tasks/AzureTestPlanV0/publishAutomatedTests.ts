import tl = require('azure-pipelines-task-lib/task');
import * as path from 'path';
import constants = require('./constants');

function publish(testRunner, resultFiles, mergeResults, failTaskOnFailedTests, platform, publishRunAttachments, testRunSystem , failTaskOnFailureToPublishResults, listOfAutomatedTestPoints) {
    var properties = <{ [key: string]: string }>{};    
    properties['type'] = testRunner;
    properties['mergeResults'] = mergeResults;
    properties['platform'] = platform;
    properties['publishRunAttachments'] = publishRunAttachments;
    properties['resultFiles'] = resultFiles;
    properties['failTaskOnFailedTests'] = failTaskOnFailedTests;
    properties['failTaskOnFailureToPublishResults'] = failTaskOnFailureToPublishResults;
    properties['testRunSystem'] = testRunSystem;
    properties['listOfAutomatedTestPoints'] = listOfAutomatedTestPoints;

    var testPlanId = tl.getInput('testPlan');
    tl.debug('testPlanId: ' + testPlanId);
    properties['testPlanId'] = testPlanId;

    tl.command('results.publish', properties, '');
}

export async function publishAutomatedTestResult(listOfAutomatedTestPoints: string) {
    try{
        const testRunner = "JUnit";
        const testResultsFiles: string[] = ["**/TEST-*.xml"];
        const mergeResults = tl.getInput('mergeTestResults');
        const platform = "any cpu";
        const publishRunAttachments = tl.getInput('publishRunAttachments');
        const failTaskOnFailedTests = tl.getInput('failTaskOnFailedTests');
        const failTaskOnMissingResultsFile: boolean = tl.getBoolInput('failTaskOnMissingResultsFile');
        const failTaskOnFailureToPublishResults = tl.getInput('failTaskOnFailureToPublishResults');
        const testRunSystem = "AzureTestPlan : " + tl.getInput("testLanguageInput").toString();

        let searchFolder = tl.getVariable('System.DefaultWorkingDirectory');

        tl.debug('testRunner: ' + testRunner);
        tl.debug('testResultsFiles: ' + testResultsFiles);
        tl.debug('mergeResults: ' + mergeResults);
        tl.debug('platform: ' + platform);
        tl.debug('publishRunAttachments: ' + publishRunAttachments);
        tl.debug('failTaskOnFailedTests: ' + failTaskOnFailedTests);
        tl.debug('failTaskOnMissingResultsFile: ' + failTaskOnMissingResultsFile);
        tl.debug('failTaskOnFailureToPublishResults: ' + failTaskOnFailureToPublishResults);

        if(tl.getVariable('System.DefaultWorkingDirectory') && (!path.isAbsolute(searchFolder)))
        {
            searchFolder = path.join(tl.getVariable('System.DefaultWorkingDirectory'),searchFolder);
        }

        const findOptions = <tl.FindOptions>{
            allowBrokenSymbolicLinks: true,
            followSpecifiedSymbolicLink: true,
            followSymbolicLinks: true
        }; 

        const matchingTestResultsFiles = tl.findMatch(searchFolder, testResultsFiles, findOptions);

        const testResultsFilesCount = matchingTestResultsFiles ? matchingTestResultsFiles.length : 0;

        tl.debug(`Detected ${testResultsFilesCount} test result files`);

        const forceMerge = testResultsFilesCount > constants.MERGE_THRESHOLD;
        if (forceMerge) {
            tl.debug('Detected large number of test result files. Merged all of them into a single file and published a single test run to optimize for test result publish performance instead of publishing hundreds of test runs');
        }

        if (testResultsFilesCount === 0) {
              if (failTaskOnMissingResultsFile) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('NoMatchingFilesFound', testResultsFiles));
            } else {
                tl.warning(tl.loc('NoMatchingFilesFound', testResultsFiles));
            }
        } else {
            publish(testRunner, matchingTestResultsFiles,
                forceMerge ? true.toString() : mergeResults,
                failTaskOnFailedTests,
                platform,
                publishRunAttachments,
                testRunSystem,
                failTaskOnFailureToPublishResults,
                listOfAutomatedTestPoints);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

