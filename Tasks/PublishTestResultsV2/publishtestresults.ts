import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as publishTestResultsTool from './publishtestresultstool';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import { publishEvent } from './cieventlogger';

const MERGE_THRESHOLD = 100;

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

        // Sending allowBrokenSymbolicLinks as true, so we don't want to throw error when symlinks are broken.
        // And can continue with other files if there are any.
        const findOptions = <tl.FindOptions>{
            allowBrokenSymbolicLinks: true,
            followSpecifiedSymbolicLink: true,
            followSymbolicLinks: true
        };

        let matchingTestResultsFiles = tl.findMatch(searchFolder, testResultsFiles, findOptions);

        const testResultsFilesCount = matchingTestResultsFiles ? matchingTestResultsFiles.length : 0;

        tl.debug(`Detected ${testResultsFilesCount} test result files`)
        const forceMerge = testResultsFilesCount > MERGE_THRESHOLD;
        if (forceMerge) {
            tl.debug('Detected large number of test result files. Merged all of them into a single file and published a single test run to optimize for test result publish performance instead of publishing hundreds of test runs');
        }

        if (testResultsFilesCount === 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
        }
        else {
            let osType = tl.osType();
            // This variable can be set as build variable to force the task to use command flow
            let isExeFlowOverridden = tl.getVariable('PublishTestResults.OverrideExeFlow');

            tl.debug('OS type: ' + osType);

            if (osType === 'Windows_NT' && isExeFlowOverridden != 'true') {
                let testResultsPublisher = new publishTestResultsTool.TestResultsPublisher(matchingTestResultsFiles, forceMerge ? true.toString() : mergeResults, platform, config, testRunTitle, publishRunAttachments, testRunner);
                let exitCode = await testResultsPublisher.publishResultsThroughExe();
                tl.debug("Exit code of TestResultsPublisher: " + exitCode);

                if (exitCode === 20000) {
                    // The exe returns with exit code: 20000 if the Feature flag is off or if it fails to fetch the Feature flag value
                    const tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
                    tp.publish(matchingTestResultsFiles, forceMerge ? true.toString() : mergeResults, platform, config, testRunTitle, publishRunAttachments);
                }                
            }
            else {
                const tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
                tp.publish(matchingTestResultsFiles, forceMerge ? true.toString() : mergeResults, platform, config, testRunTitle, publishRunAttachments);
            }
        }

        publishEvent({
            'mergeResultsUserPreference': mergeResults,
            'testResultsFilesCount': testResultsFilesCount
        });

        tl.setResult(tl.TaskResult.Succeeded, '');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}

run();