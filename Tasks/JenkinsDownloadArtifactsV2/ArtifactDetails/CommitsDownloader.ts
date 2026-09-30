import * as os from 'os';
import * as path from 'path';
import * as Q from 'q';
import url = require('url');

import * as  tl from 'azure-pipelines-task-lib/task';


import { ArtifactDetailsDownloaderBase } from "./ArtifactDetailsDownloaderBase"
import { JenkinsRestClient, JenkinsJobDetails } from "./JenkinsRestClient"

var handlebars = require('handlebars');

const CommitTemplateBase: string = `{{#with changeSet as |changes|}}
  {{#each changes.items as |commit|}}
  {
    "Id": "{{commit.commitId}}",
    "Message": "{{commit.msg}}",
    "Author": {
      "displayName": "{{commit.author.fullName}}"
    },
    {{#caseIgnoreEqual changes.kind 'git'}}
    {{#with (lookupAction ../../actions 'remoteUrls') as |action|}}
    {{#if action.remoteUrls}}
    "DisplayUri": "{{#first action.remoteUrls}}{{/first}}/commit/{{commit.commitId}}",
    {{/if}}
    {{/with}}
    {{/caseIgnoreEqual}}
    "Timestamp": "{{commit.date}}"
  },
  {{/each}}
  {{/with}}`;

const CommitsTemplate: string = `[
  {{#each (lookup . buildParameter)}}
  {{> commit this}}
  {{/each}}
]`;

const CommitTemplate: string = `[
    ${CommitTemplateBase}
]`;

const GetCommitMessagesTemplate: string = `{{pluck . 'Message'}}`

export class CommitsDownloader extends ArtifactDetailsDownloaderBase {
    private jenkinsClient: JenkinsRestClient;

    constructor() {
        super();

        handlebars.registerPartial('commit', CommitTemplateBase);
        this.jenkinsClient = new JenkinsRestClient();
    }

    public static GetCommitMessagesFromCommits(commits: string): string[] {
        console.log(tl.loc("GetCommitMessages"));

        let template = handlebars.compile(GetCommitMessagesTemplate);
        try {
            var result = template(JSON.parse(commits));
        } catch (error) {
            tl.writeExternalOutput(tl.loc("GetCommitMessagesFailed", error, commits) + os.EOL, { source: "remote" });
            throw error;
        }

        tl.debugExternalOutput(`Commit messages: ${result}`, { source: "remote" });
        return result.split(',');
    }

    public DownloadFromSingleBuildAndSave(jenkinsJobDetails: JenkinsJobDetails): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        console.log(tl.loc("GettingCommitsFromSingleBuild", jenkinsJobDetails.buildId));
        this.GetCommitsFromSingleBuild(jenkinsJobDetails).then((commits: string) => {
            this.UploadCommits(commits).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    public DownloadFromBuildRangeAndSave(jenkinsJobDetails: JenkinsJobDetails, startIndex: number, endIndex: number): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetCommits(jenkinsJobDetails, startIndex, endIndex).then((commits: string) => {
            this.UploadCommits(commits).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFromSingleBuild(jenkinsJobDetails: JenkinsJobDetails): Q.Promise<string> {
        let defer = Q.defer<string>();

        const commitsUrl: string = `${jenkinsJobDetails.multiBranchPipelineUrlInfix}/${jenkinsJobDetails.buildId}/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]`;

        this.jenkinsClient.DownloadJsonContent(commitsUrl, CommitTemplate, null).then((commitsResult) => {
            tl.debugExternalOutput(`Downloaded commits: ${commitsResult}`, { source: "remote" });

            var commits: string = this.TransformCommits(commitsResult);
            defer.resolve(commits);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommits(jenkinsJobDetails: JenkinsJobDetails, startIndex: number, endIndex: number): Q.Promise<string> {
        let defer = Q.defer<string>();

        const buildParameter: string = (startIndex >= 100 || endIndex >= 100) ? "allBuilds" : "builds"; // jenkins by default will return only 100 top builds. Have to use "allBuilds" if we are dealing with build which are older than 100 builds
        const commitsUrl: string = `${jenkinsJobDetails.multiBranchPipelineUrlInfix}/api/json?tree=${buildParameter}[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{${endIndex},${startIndex}}`;

        tl.debug(`Downloading commits from startIndex ${startIndex} and endIndex ${endIndex}`);
        this.jenkinsClient.DownloadJsonContent(commitsUrl, CommitsTemplate, { 'buildParameter': buildParameter }).then((commitsResult) => {
            tl.debugExternalOutput(`Downloaded commits: ${commitsResult}`, { source: "remote" });

            var commits: string = this.TransformCommits(commitsResult);
            defer.resolve(commits);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private UploadCommits(commits: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();
        let commitsFilePath = path.join(os.tmpdir(), this.GetCommitsFileName());

        console.log(tl.loc("WritingCommitsTo", commitsFilePath));
        this.WriteContentToFileAndUploadAsAttachment(commits, commitsFilePath).then(() => {
            console.log(tl.loc("SuccessfullyUploadedCommitsAttachment"));
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

    private TransformCommits(commits: string): string {
        if (!!commits) {

            // remove the extra comma at the end of the commit item
            let index: number = commits.lastIndexOf(",");
            if (index > -1) {
                commits = commits.substring(0, index) + commits.substring(index + 1);
            }

            try {
                var commitMessages = JSON.parse(commits);

                commitMessages.forEach((commit) => {
                    tl.debugExternalOutput('Normalizing url' + commit.DisplayUri, { source: "remote" });
                    commit.DisplayUri = this.TransformCommitUrl(commit.DisplayUri);
                });

                return JSON.stringify(commitMessages);

            } catch (error) {
                tl.writeExternalOutput(tl.loc("CannotParseCommits", commits, error) + os.EOL, { source: "remote" });
                throw error;
            }
        }

        return '';
    };

    private TransformCommitUrl(commitUrl: string): string {
        commitUrl = this.ConvertGitProtocolUrlToHttpProtocol(commitUrl);

        try {
            if (url.parse(commitUrl).hostname.toUpperCase() == this.BitBucketHostName.toUpperCase()) {
                commitUrl = commitUrl.replace('/commit/', '/commits/')
            }
        } catch (error) {
            tl.debugExternalOutput(`Error while parsing the commit url ${commitUrl}`, { source: "remote" });
        }

        tl.debugExternalOutput(`Translated url ${commitUrl} after fixing the query path based on the provider`, { source: "remote" });
        return commitUrl;
    }

    private ConvertGitProtocolUrlToHttpProtocol(commitUrl: string): string {
        var result: string = '';
        if (!!commitUrl) {
            if (commitUrl.startsWith('git@')) {
                tl.debug('repo url is a git protocol url');

                if (commitUrl.startsWith('git@gitlab.com')) {
                    result = commitUrl.replace('git@gitlab.com:', 'https://gitlab.com/').replace('.git/', '/');
                }
                else if (commitUrl.startsWith('git@github.com')) {
                    result = commitUrl.replace('git@github.com:', 'https://github.com/').replace('.git/', '/');
                }
            }
            else if (commitUrl.startsWith('http')) {
                // if its http return the url as is.
                result = commitUrl;
            }
        }

        tl.debugExternalOutput(`Translated url ${commitUrl} to ${result}`, { source: "remote" });
        return result;
    }

    private BitBucketHostName: string = "bitbucket.org";
}