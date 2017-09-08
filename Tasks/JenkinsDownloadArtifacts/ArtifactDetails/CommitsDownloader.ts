import * as Q from 'q';
import * as os from 'os';
import * as path from 'path';
import * as  tl from 'vsts-task-lib/task';

import {ArtifactDetailsDownloaderBase} from "./ArtifactDetailsDownloaderBase"
import {JenkinsRestClient} from "./JenkinsRestClient"

var handlebars = require('handlebars');

const CommitTemplateBase: string = `{{#with changeSet as |changes|}}
  {{#each changes.items as |commit|}}
  {
    "Id": "{{commit.commitId}}",
    "Message": "{{commit.msg}}",
    "Author": {
      "displayName": "{{commit.author.fullName}}"
    },
    {{#CaseIgnoreEqual changes.kind 'git'}}
    {{#with (lookupAction ../../actions 'remoteUrls') as |action|}}
    {{#if action.remoteUrls}}
    "DisplayUri": "{{#first action.remoteUrls}}{{/first}}/commit/{{commit.commitId}}",
    {{/if}}
    {{/with}}
    {{/CaseIgnoreEqual}}
    "Timestamp": "{{commit.date}}"
  },
  {{/each}}
  {{/with}}`;

const CommitsTemplate: string = `[
  {{#each (lookup . buildParameter)}}
  {{> commit this}}
  {{/each}}
]`;

const commitTemplate: string = `[
    ${CommitTemplateBase}
]`;

const GetCommitMessagesTemplate: string = `{{pluck . 'Message'}}`

export class CommitsDownloader extends ArtifactDetailsDownloaderBase {
    private jenkinsClient: JenkinsRestClient;
    private commitsFilePath: string;

    constructor() {
        super();

        handlebars.registerPartial('commit', CommitTemplateBase);
        this.jenkinsClient = new JenkinsRestClient();

        let tempDir: string = os.tmpdir();
        let commitsFileName: string = this.GetCommitsFileName();
        this.commitsFilePath = path.join(/*"d:\\"*/tempDir, commitsFileName);
    }

    public static GetCommitMessagesFromCommits(commits: string): string[] {
        tl.debug(`Extracting commit messages from commits`);

        // remove the extra comma at the end of the commit item
        let index: number = commits.lastIndexOf(",");
        if (index > -1) {
            commits = commits.substring(0, index) + commits.substring(index + 1);
        }

        let template = handlebars.compile(GetCommitMessagesTemplate);
        try {
            var result = template(JSON.parse(commits));
        } catch(error) {
            console.log(`Fetching commits message failed with an error ${error}`);
            throw error;
        }

        tl.debug(`Extracted commits ${result}`);
        return result.split(',');
    }

    public DownloadFromSingleBuildAndSave(job: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        console.log(`Getting commits associated with the build ${job}`);
        this.GetCommitsFromSingleBuild(job).then((commits: string) => {
            this.UploadCommits(commits, this.commitsFilePath).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        })        

        return defer.promise;
    }

    public DownloadFromBuildRangeAndSave(startIndex: number, endIndex: number): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetCommits(startIndex, endIndex).then((commits: string) => {
            this.UploadCommits(commits, this.commitsFilePath).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommits(startIndex: number, endIndex: number): Q.Promise<string> {
        let defer = Q.defer<string>();

        const buildParameter: string = (startIndex >= 100 || endIndex >= 100) ? "allBuilds" : "builds"; // jenkins by default will return only 100 top builds. Have to use "allBuilds" if we are dealing with build which are older than 100 builds
        const commitsUrl: string = `/api/json?tree=${buildParameter}[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{${endIndex},${startIndex}}`;

        console.log('Downloading commits');
        this.jenkinsClient.DownloadJsonContent(commitsUrl, CommitsTemplate, {'buildParameter': buildParameter}).then((commitsResult) => {
            tl.debug(`Processed commits ${commitsResult}`);
            defer.resolve(commitsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFromSingleBuild(job: string): Q.Promise<string> {
        let defer = Q.defer<string>();

        const commitsUrl: string = `/${job}/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]`;

        console.log(`Downloading commits from the job ${job}`);
        this.jenkinsClient.DownloadJsonContent(commitsUrl, commitTemplate, null).then((commitsResult) => {
            tl.debug(`Processed commits ${commitsResult}`);
            defer.resolve(commitsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private UploadCommits(commits: string, commitsFilePath: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        console.log(`Writing commits to ${commitsFilePath}`);
        this.UploadAttachment(commits, commitsFilePath).then(() => {
            console.log('uploaded commits attachment');
            defer.resolve(null);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFileName(): string {
        let fileName: string = "commits.json";
        let commitfileName: string = tl.getInput("artifactDetailsFileNameSuffix", false);

        if (commitfileName) {
            fileName = `commits_${commitfileName}`;
        }

        return fileName;
    }
}