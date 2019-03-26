import * as path from 'path';
import * as publishTestResultsTool from './publishtestresultstool';
import * as tl from 'vsts-task-lib/task';
import * as ci from './cieventlogger';

const MERGE_THRESHOLD = 100;
const TESTRUN_SYSTEM = 'VSTS - PTR';

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function publish(testRunner, resultFiles, mergeResults, failTaskOnFailedTests, platform, config, runTitle, publishRunAttachments, testRunSystem) {
    var properties = <{ [key: string]: string }>{};
    properties['type'] = testRunner;

    if (mergeResults) {
        properties['mergeResults'] = mergeResults;
    }
    if (platform) {
        properties['platform'] = platform;
    }
    if (config) {
        properties['config'] = config;
    }
    if (runTitle) {
        properties['runTitle'] = runTitle;
    }
    if (publishRunAttachments) {
        properties['publishRunAttachments'] = publishRunAttachments;
    }
    if (resultFiles) {
        properties['resultFiles'] = resultFiles;
    }   
    if(failTaskOnFailedTests){
        properties['failTaskOnFailedTests'] = failTaskOnFailedTests;
    }
    properties['testRunSystem'] = testRunSystem;

    tl.command('results.publish', properties, '');
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
        const failTaskOnFailedTests = tl.getInput('failTaskOnFailedTests');
        let searchFolder = tl.getInput('searchFolder');

        tl.debug('testRunner: ' + testRunner);
        tl.debug('testResultsFiles: ' + testResultsFiles);
        tl.debug('mergeResults: ' + mergeResults);
        tl.debug('platform: ' + platform);
        tl.debug('config: ' + config);
        tl.debug('testRunTitle: ' + testRunTitle);
        tl.debug('publishRunAttachments: ' + publishRunAttachments);
        tl.debug('failTaskOnFailedTests: ' + failTaskOnFailedTests);

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

        const matchingTestResultsFiles = tl.findMatch(searchFolder, testResultsFiles, findOptions);

        const testResultsFilesCount = matchingTestResultsFiles ? matchingTestResultsFiles.length : 0;

        tl.debug(`Detected ${testResultsFilesCount} test result files`);

        ci.addToConsolidatedCi('testRunner', testRunner);
        ci.addToConsolidatedCi('failTaskOnFailedTests', failTaskOnFailedTests);
        ci.addToConsolidatedCi('mergeResultsUserPreference', mergeResults);
        ci.addToConsolidatedCi('config', config);
        ci.addToConsolidatedCi('platform', platform);
        ci.addToConsolidatedCi('testResultsFilesCount', testResultsFilesCount);

        const forceMerge = testResultsFilesCount > MERGE_THRESHOLD;
        if (forceMerge) {
            tl.debug('Detected large number of test result files. Merged all of them into a single file and published a single test run to optimize for test result publish performance instead of publishing hundreds of test runs');
        }

        if (testResultsFilesCount === 0) {
            tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
            ci.addToConsolidatedCi('noResultsFileFound', true);
        } else {
            const osType = tl.osType();
            // This variable can be set as build variable to force the task to use command flow
            const isExeFlowOverridden = tl.getVariable('PublishTestResults.OverrideExeFlow');

            tl.debug('OS type: ' + osType);

            if (osType === 'Windows_NT' && isExeFlowOverridden != 'true') {
                const testResultsPublisher = new publishTestResultsTool.TestResultsPublisher(matchingTestResultsFiles,
                    forceMerge ? true.toString() : mergeResults,
                    failTaskOnFailedTests,
                    platform,
                    config,
                    testRunTitle,
                    publishRunAttachments,
                    testRunner,
                    TESTRUN_SYSTEM);
                const exitCode = await testResultsPublisher.publishResultsThroughExe();
                tl.debug("Exit code of TestResultsPublisher: " + exitCode);

                if (exitCode === 20000) {
                    // The exe returns with exit code: 20000 if the Feature flag is off or if it fails to fetch the Feature flag value
                    publish(testRunner, matchingTestResultsFiles,
                        forceMerge ? true.toString() : mergeResults,
                        failTaskOnFailedTests,
                        platform,
                        config,
                        testRunTitle,
                        publishRunAttachments,
                        TESTRUN_SYSTEM);
                }
                else if(exitCode == 40000){
                    // The exe returns with exit code: 40000 if there are test failures found and failTaskOnFailedTests is true
                    ci.addToConsolidatedCi('failedTestsInRun', true);
                    tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnFailedTests'));
                }
            } else {
                publish(testRunner, matchingTestResultsFiles,
                    forceMerge ? true.toString() : mergeResults,
                    failTaskOnFailedTests,
                    platform,
                    config,
                    testRunTitle,
                    publishRunAttachments,
                    TESTRUN_SYSTEM);
            }
        }
        tl.setResult(tl.TaskResult.Succeeded, '');
    } catch (err) {       
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        ci.fireConsolidatedCi();
    }
}

run();
