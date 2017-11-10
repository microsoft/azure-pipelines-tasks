import * as featuremanagementapim from 'vso-node-api/FeatureManagementApi';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as webapim from 'vso-node-api/WebApi';

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

    var PublishTaskFF = tl.getVariable('PublishTaskFF');
    // For windows platform, publish results using TestResultsPublisher.exe
    if (tl.osType() === 'Windows_NT' && PublishTaskFF == "true") {
        publishResultsThroughExe();
    }
    else {
        // For all OS other than Windows, continue using older flow
        let tp: tl.TestPublisher = new tl.TestPublisher(testRunner);
        tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
    }
}

tl.setResult(tl.TaskResult.Succeeded, '');


async function publishResultsThroughExe() {
    let testResultsPublisherTool: tr.ToolRunner = tl.tool(getTestResultsPublisherLocation());
    let envVars: { [key: string]: string; } = getEnvironmentVariables();
    let args: string[] = getArguments();
    testResultsPublisherTool.arg(args);

    try {
        await testResultsPublisherTool.exec(<tr.IExecOptions>{ env: envVars });
    } catch (err) {
        tl.warning("Error while executing TestResultsPublisher: " + err);
    }
}

function getTestResultsPublisherLocation(): string {
    return path.join(__dirname, 'TestResultsPublisher.exe');
}

function getArguments(): string[] {
    let responseFilePath = createResponseFile();
    // Adding '@' because this is a response file argument
    let args = ['@' + responseFilePath];
    return args;

}

function createResponseFile(): string {
    let responseFilePath: string = path.join(__dirname, 'tempResponseFile.txt');

    // Adding quotes around matching file names
    matchingTestResultsFiles.forEach(function (matchingFileName, i) {
        matchingTestResultsFiles[i] = modifyMatchingFileName(matchingFileName);
    });

    // Preparing File content
    let fileContent: string = os.EOL + matchingTestResultsFiles.join(os.EOL);

    // Writing matching file names in the response file
    fs.writeFileSync(responseFilePath, fileContent);

    return responseFilePath;
}

function modifyMatchingFileName(matchingFileName: string): string {
    // We need to add quotes around the file name because the file name can contain spaces.
    // The quotes will be handled by response file reader.
    return '\"' + matchingFileName + '\"';
}

function getEnvironmentVariables(): { [key: string]: string; } {
    let envVars: { [key: string]: string; } = {};

    addToProcessEnvVars(envVars, 'collectionurl', tl.getVariable('System.TeamFoundationCollectionUri'));
    addToProcessEnvVars(envVars, 'accesstoken', tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false));

    addToProcessEnvVars(envVars, 'testrunner', testRunner);
    addToProcessEnvVars(envVars, 'mergeresults', mergeResults);
    addToProcessEnvVars(envVars, 'platform', platform);
    addToProcessEnvVars(envVars, 'config', config);
    addToProcessEnvVars(envVars, 'publishrunattachments', publishRunAttachments);
    addToProcessEnvVars(envVars, 'testruntitle', testRunTitle);
    addToProcessEnvVars(envVars, 'publishrunattachments', publishRunAttachments);
    addToProcessEnvVars(envVars, 'projectname', tl.getVariable('System.TeamProject'));
    addToProcessEnvVars(envVars, 'owner', tl.getVariable('Build.RequestedFor'));
    addToProcessEnvVars(envVars, 'buildid', tl.getVariable('Build.BuildId'));
    addToProcessEnvVars(envVars, 'builduri', tl.getVariable('Build.BuildUri'));
    addToProcessEnvVars(envVars, 'releaseuri', tl.getVariable('Release.ReleaseUri'));
    addToProcessEnvVars(envVars, 'releaseenvironmenturi', tl.getVariable('Release.ReleaseEnvironmentUri'));

    return envVars;
}

function addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string): void {
    if (!isNullEmptyOrUndefined(value)) {
        envVars[name] = value;
    }
}

function isNullEmptyOrUndefined(obj): boolean {
    return obj === null || obj === '' || obj === undefined;
}

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}