import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as path from 'path';

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
    tl.warning('No test result files matching ' + testResultsFiles + ' were found.');
}
else {
    tl.debug('OS type: ' + tl.osType());

    // For windows platform, publish results using TestResultsPublisher.exe
    if (tl.osType() === 'Windows_NT') {
        publishResultsThroughExe();
    }
    else {
        // For all OS other than Windows, continue using older flow
        let tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
        tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
    }
}

tl.setResult(tl.TaskResult.Succeeded, '');


function publishResultsThroughExe(): void {
    let testResultsPublisherTool: tr.ToolRunner = tl.tool(getTestResultsPublisherLocation());
    let envVars: { [key: string]: string; } = getEnvironmentVariables();
    let args: string[] = getArguments();
    testResultsPublisherTool.arg(args);
    let TestResultsPublisherExecutionResult = testResultsPublisherTool.execSync(<tr.IExecSyncOptions>{ env: envVars }).stdout;
}

function getTestResultsPublisherLocation(): string {
    return path.join(__dirname, 'TestResultsPublisher.exe');
}

function getArguments(): string[] {
    return matchingTestResultsFiles;
}

function getEnvironmentVariables(): { [key: string]: string; } {
    let envVars: { [key: string]: string; } = {};

    addToProcessEnvVars(envVars, 'collectionUrl', tl.getVariable('System.TeamFoundationCollectionUri'));
    addToProcessEnvVars(envVars, 'accessToken', tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false));

    addToProcessEnvVars(envVars, 'testRunner', testRunner);
    addToProcessEnvVars(envVars, 'mergeResults', mergeResults);
    addToProcessEnvVars(envVars, 'platform', platform);
    addToProcessEnvVars(envVars, 'config', config);
    addToProcessEnvVars(envVars, 'publishRunAttachments', publishRunAttachments);
    addToProcessEnvVars(envVars, 'testRunTitle', testRunTitle);
    addToProcessEnvVars(envVars, 'publishRunAttachments', publishRunAttachments);
    addToProcessEnvVars(envVars, 'projectName', tl.getVariable('System.TeamProject'));
    addToProcessEnvVars(envVars, 'owner', tl.getVariable('Build.RequestedFor'));
    addToProcessEnvVars(envVars, 'buildId', tl.getVariable('Build.BuildId'));
    addToProcessEnvVars(envVars, 'buildUri', tl.getVariable('Build.BuildUri'));
    addToProcessEnvVars(envVars, 'releaseUri', tl.getVariable('Release.ReleaseUri'));
    addToProcessEnvVars(envVars, 'releaseEnvironmentUri', tl.getVariable('Release.ReleaseEnvironmentUri'));

    return envVars;
}

function addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string): void {
    if (!isNullEmptyOrUndefinedddd(value)) {
        envVars[name] = value;
    }
}

function isNullEmptyOrUndefinedddd(obj): boolean {
    return obj === null || obj === '' || obj === undefined;
}

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}