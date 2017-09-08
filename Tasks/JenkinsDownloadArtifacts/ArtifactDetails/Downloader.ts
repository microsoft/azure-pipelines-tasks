import * as Q from 'q';
import * as  tl from 'vsts-task-lib/task';

import {JenkinsRestClient} from "./JenkinsRestClient"
import {CommitsDownloader} from "./CommitsDownloader"
import {WorkItemsDownloader} from "./WorkItemsDownloader"

var handlebars = require('handlebars');

export class ArtifactDetailsDownloader {
    public DownloadCommitsAndWorkItems(): Q.Promise<void> {
        let defer: Q.Deferred<any> = Q.defer<any>();

        console.log(tl.loc("DownloadingCommitsAndWorkItems"));
        
        let startJobId: number = parseInt(tl.getInput("previousJenkinsBuildNumber"))
        let commitsDownloader: CommitsDownloader = new CommitsDownloader();

        if (!startJobId) {
            let jenkinsBuild = tl.getInput('jenkinsBuild', true);
            let endJob: string = "";

            if (jenkinsBuild === 'LastSuccessfulBuild') {
                // If its LastSuccessfulBuild, we don't need to fetch the build number, we could just use the lastSuccessfulFull macro
                endJob = 'lastSuccessfulBuild';
            }
            else {
                // if its not LastSuccessfulBuild try to get the build number from input.
                endJob = tl.getInput("jenkinsBuildNumber", false)
            }

            console.log(tl.loc("JenkinsDownloadingChangeFromCurrentBuild", endJob));

            commitsDownloader.DownloadFromSingleBuildAndSave(endJob).then((commits: string) => {
                    let commitMessages: string[] = CommitsDownloader.GetCommitMessagesFromCommits(commits);
                    let workItemsDownloader: WorkItemsDownloader = new WorkItemsDownloader(commitMessages); 
                    workItemsDownloader.DownloadFromSingleBuildAndSave(endJob).then(() => {
                        defer.resolve(null);
                    }, (error) => {
                        defer.reject(error);
                    });
            }, (error) => {
                defer.reject(error);
            });
        }
        else {
            let endJobId = parseInt(tl.getInput("jenkinsBuildNumber", true));
            if (startJobId < endJobId) {
                console.log(tl.loc("DownloadingJenkinsChangeBetween", startJobId, endJobId));
            }
            else if (startJobId > endJobId) {
                console.log(tl.loc("JenkinsRollbackDeployment", startJobId, endJobId));

                // swap the job IDs to fetch the roll back commits
                let temp: number = startJobId;
                startJobId = endJobId;
                endJobId = temp;
            }
            else if (startJobId == endJobId) {
                console.log(tl.loc("JenkinsNoCommitsToFetch"));
                defer.resolve(null);
                return defer.promise;
            }

            // #1. Since we have two builds, we need to figure the build index
            this.GetJobIdIndex(startJobId, endJobId).then((buildIndex) => {
                let startIndex: number = buildIndex['startIndex'];
                let endIndex: number = buildIndex['endIndex'];

                //#2. Download the commits using range and save
                commitsDownloader.DownloadFromBuildRangeAndSave(startIndex, endIndex).then((commits: string) => {
                    //#3. download workitems
                    let commitMessages: string[] = CommitsDownloader.GetCommitMessagesFromCommits(commits);
                    let workItemsDownloader: WorkItemsDownloader = new WorkItemsDownloader(commitMessages); 
                    workItemsDownloader.DownloadFromBuildRangeAndSave(startIndex, endIndex).then(() => {
                        defer.resolve(null);
                    }, (error) => {
                        defer.reject(error);
                    });
                }, (error) => {
                    defer.reject(error);
                })
            }, (error) => {
                defer.reject(error);
            });
        }

        return defer.promise;
    }

    private GetJobIdIndex(startJobId, endJobId): Q.Promise<any> {
        let defer = Q.defer<any>();
        let jobUrl: string = "/api/json?tree=allBuilds[number]";
        let startIndex: number = 0;
        let endIndex: number = 0;

        console.log(tl.loc("FindBuildIndex"));
        handlebars.registerHelper('JobIndex', function(jobId, index, options) {
            if(jobId == startJobId) {
                startIndex = index;
            } else if (jobId == endJobId) {
                endIndex = index;
            }

            return options.fn(this);
        });

        let source: string = '{{#each allBuilds}}{{#JobIndex this.number @index}}{{/JobIndex}}{{/each}}';
        let downloadHelper: JenkinsRestClient = new JenkinsRestClient();
        downloadHelper.DownloadJsonContent(jobUrl, source, null).then(() => {
            console.log(tl.loc("FoundBuildIndex", startIndex, endIndex));
            if (startIndex === 0 || endIndex === 0) {
                console.debug('cannot find valid startIndex or endIndex');
                defer.reject('failed to find build index');
            }
            else {
                defer.resolve({startIndex: startIndex, endIndex: endIndex});
            }
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}
