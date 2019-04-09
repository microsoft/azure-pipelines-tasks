import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import { publishEvent } from './cieventlogger';
import * as ci from './cieventlogger';
let uuid = require('uuid');

export class TestResultsPublisher {
    constructor(matchingTestResultsFiles: string[], mergeResults: string, failTaskOnFailedTests: string, platform: string, config: string,
        testRunTitle: string, publishRunAttachments: string, testRunner: string, testRunSystem: string) {

        this.matchingTestResultsFiles = matchingTestResultsFiles.slice(0);
        this.mergeResults = mergeResults;
        this.failTaskOnFailedTests = failTaskOnFailedTests;
        this.platform = platform;
        this.config = config;
        this.testRunTitle = testRunTitle;
        this.publishRunAttachments = publishRunAttachments;
        this.testRunner = testRunner;
        this.testRunSystem = testRunSystem;
    }

    public async publishResultsThroughExe(): Promise<number> {
        const testResultsPublisherTool: tr.ToolRunner = tl.tool(this.getTestResultsPublisherLocation());
        const envVars: { [key: string]: string; } = this.getEnvironmentVariables();
        const args: string[] = this.getArguments(this.matchingTestResultsFiles);
        if (testResultsPublisherTool == null || args == null) {
            return 20000;
        }
        testResultsPublisherTool.arg(args);

        const exitCode: number = await testResultsPublisherTool.exec(<tr.IExecOptions>{ env: envVars, ignoreReturnCode: true });

        return exitCode;
    }

    private getTestResultsPublisherLocation(): string {
        return path.join(__dirname, 'modules/TestResultsPublisher.exe');
    }

    private getArguments(matchingTestResultsFiles: string[]): string[] {
        const responseFilePath = this.createResponseFile(matchingTestResultsFiles);
        if (responseFilePath == null) {
            return null;
        }
        // Adding '@' because this is a response file argument
        const args = ['@' + responseFilePath];

        return args;
    }

    private createResponseFile(matchingTestResultsFiles: string[]): string {
        let responseFilePath: string = null;
        try {
            const agentTempDirectory = tl.getVariable('Agent.TempDirectory');
            // The response file is being created in agent temp directory so that it is automatically deleted after.
            responseFilePath = path.join(agentTempDirectory, uuid.v1() + '.txt');

            // Adding quotes around matching file names
            matchingTestResultsFiles = this.modifyMatchingFileName(matchingTestResultsFiles);

            // Preparing File content
            const fileContent: string = os.EOL + matchingTestResultsFiles.join(os.EOL);

            // Writing matching file names in the response file
            fs.writeFileSync(responseFilePath, fileContent);
        } catch (ex) {
            // Log telemetry and return null path
            ci.addToConsolidatedCi('exception', ex);
            
            tl.warning("Exception while writing to response file: " + ex);
            return null;
        }

        return responseFilePath;
    }

    private modifyMatchingFileName(matchingTestResultsFiles: string[]): string[] {
        for (let i = 0; i < this.matchingTestResultsFiles.length; i++) {
            // We need to add quotes around the file name because the file name can contain spaces.
            // The quotes will be handled by response file reader.
            matchingTestResultsFiles[i] = '\"' + matchingTestResultsFiles[i] + '\"';
        }

        return matchingTestResultsFiles;
    }

    private getEnvironmentVariables(): { [key: string]: string; } {
        let envVars: { [key: string]: string; } = {};

        envVars = this.addToProcessEnvVars(envVars,
             'collectionurl',
              tl.getVariable('System.TeamFoundationCollectionUri'));
        envVars = this.addToProcessEnvVars(envVars,
            'accesstoken',
             tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false));
        envVars = this.addToProcessEnvVars(envVars, 'testrunner', this.testRunner);
        envVars = this.addToProcessEnvVars(envVars, 'mergeresults', this.mergeResults);
        envVars = this.addToProcessEnvVars(envVars, 'failtaskonfailedtests', this.failTaskOnFailedTests);
        envVars = this.addToProcessEnvVars(envVars, 'platform', this.platform);
        envVars = this.addToProcessEnvVars(envVars, 'config', this.config);
        envVars = this.addToProcessEnvVars(envVars, 'publishrunattachments', this.publishRunAttachments);
        envVars = this.addToProcessEnvVars(envVars, 'testruntitle', this.testRunTitle);
        envVars = this.addToProcessEnvVars(envVars, 'testrunsystem', this.testRunSystem);
        envVars = this.addToProcessEnvVars(envVars, 'projectname', tl.getVariable('System.TeamProject'));
        envVars = this.addToProcessEnvVars(envVars, 'pullrequesttargetbranch', tl.getVariable('System.PullRequest.TargetBranch'));
        envVars = this.addToProcessEnvVars(envVars, 'owner', tl.getVariable('Build.RequestedFor'));
        envVars = this.addToProcessEnvVars(envVars, 'buildid', tl.getVariable('Build.BuildId'));
        envVars = this.addToProcessEnvVars(envVars, 'builduri', tl.getVariable('Build.BuildUri'));
        envVars = this.addToProcessEnvVars(envVars, 'releaseuri', tl.getVariable('Release.ReleaseUri'));
        envVars = this.addToProcessEnvVars(envVars, 'releaseenvironmenturi', tl.getVariable('Release.EnvironmentUri'));
        return envVars;
    }

    private addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string): { [key: string]: string; } {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value;
        }

        return envVars;
    }

    private isNullEmptyOrUndefined(obj): boolean {
        return obj === null || obj === '' || obj === undefined;
    }

    private matchingTestResultsFiles: string[];
    private mergeResults: string;
    private failTaskOnFailedTests: string;
    private platform: string;
    private config: string;
    private testRunTitle: string;
    private publishRunAttachments: string;
    private testRunner: string;
    private testRunSystem: string;
}
