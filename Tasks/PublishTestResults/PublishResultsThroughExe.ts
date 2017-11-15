import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as vsts from 'vso-node-api';

export class TestResultsPublisher {
    constructor(matchingTestResultsFiles: string[], mergeResults: string, platform: string, config: string,
        testRunTitle: string, publishRunAttachments: string, testRunner: string) {

        this.matchingTestResultsFiles = matchingTestResultsFiles;
        this.mergeResults = mergeResults;
        this.platform = platform;
        this.config = config;
        this.testRunTitle = testRunTitle;
        this.publishRunAttachments = publishRunAttachments;
        this.testRunner = testRunner;
    }

    public async publishResultsThroughExe() {
        let testResultsPublisherTool: tr.ToolRunner = tl.tool(this.getTestResultsPublisherLocation());
        let envVars: { [key: string]: string; } = this.getEnvironmentVariables();
        let args: string[] = this.getArguments();
        testResultsPublisherTool.arg(args);

        try {
            await testResultsPublisherTool.exec(<tr.IExecOptions>{ env: envVars });
        } catch (err) {
            tl.warning(tl.loc("ErrorTestResultsPublisher", err));
        }
    }

    private getTestResultsPublisherLocation(): string {
        return path.join(__dirname, 'modules/TestResultsPublisher.exe');
    }

    private getArguments(): string[] {
        let responseFilePath = this.createResponseFile();
        // Adding '@' because this is a response file argument
        let args = ['@' + responseFilePath];
        return args;

    }

    private createResponseFile(): string {
        let responseFilePath: string = path.join(__dirname, 'tempResponseFile.txt');

        // Adding quotes around matching file names
        this.matchingTestResultsFiles = this.modifyMatchingFileName(this.matchingTestResultsFiles);
        
        // Preparing File content
        let fileContent: string = os.EOL + this.matchingTestResultsFiles.join(os.EOL);

        // Writing matching file names in the response file
        fs.writeFileSync(responseFilePath, fileContent);

        return responseFilePath;
    }

    private modifyMatchingFileName(matchingTestResultsFiles: string[]): string[] {
        for (let i = 0; i < matchingTestResultsFiles.length; i++) {
            // We need to add quotes around the file name because the file name can contain spaces.
            // The quotes will be handled by response file reader.
            matchingTestResultsFiles[i] = '\"' + matchingTestResultsFiles[i] + '\"';
        }
        return matchingTestResultsFiles;
    }

    private getEnvironmentVariables(): { [key: string]: string; } {
        let envVars: { [key: string]: string; } = {};

        envVars = this.addToProcessEnvVars(envVars, 'collectionurl', tl.getVariable('System.TeamFoundationCollectionUri'));
        envVars = this.addToProcessEnvVars(envVars, 'accesstoken', tl.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false));

        envVars = this.addToProcessEnvVars(envVars, 'testrunner', this.testRunner);
        envVars = this.addToProcessEnvVars(envVars, 'mergeresults', this.mergeResults);
        envVars = this.addToProcessEnvVars(envVars, 'platform', this.platform);
        envVars = this.addToProcessEnvVars(envVars, 'config', this.config);
        envVars = this.addToProcessEnvVars(envVars, 'publishrunattachments', this.publishRunAttachments);
        envVars = this.addToProcessEnvVars(envVars, 'testruntitle', this.testRunTitle);
        envVars = this.addToProcessEnvVars(envVars, 'projectname', tl.getVariable('System.TeamProject'));
        envVars = this.addToProcessEnvVars(envVars, 'owner', tl.getVariable('Build.RequestedFor'));
        envVars = this.addToProcessEnvVars(envVars, 'buildid', tl.getVariable('Build.BuildId'));
        envVars = this.addToProcessEnvVars(envVars, 'builduri', tl.getVariable('Build.BuildUri'));
        envVars = this.addToProcessEnvVars(envVars, 'releaseuri', tl.getVariable('Release.ReleaseUri'));
        envVars = this.addToProcessEnvVars(envVars, 'releaseenvironmenturi', tl.getVariable('Release.ReleaseEnvironmentUri'));

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
    private platform: string;
    private config: string;
    private testRunTitle: string;
    private publishRunAttachments: string;
    private testRunner: string;
}