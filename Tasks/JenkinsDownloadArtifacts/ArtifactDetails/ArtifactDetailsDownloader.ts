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
        
        let startBuildId: number = parseInt(tl.getInput("startJenkinsBuildNumber"))
        let commitsDownloader: CommitsDownloader = new CommitsDownloader();

        if (isNaN(startBuildId) || !startBuildId) {
            let jenkinsBuild = tl.getInput('jenkinsBuild', true);
            let endBuildId: string = "";

            if (jenkinsBuild === 'LastSuccessfulBuild') {
                // If its LastSuccessfulBuild, we don't need to fetch the build number, we could just use the lastSuccessfulFull macro
                endBuildId = 'lastSuccessfulBuild';
            }
            else {
                // if its not LastSuccessfulBuild try to get the build number from input.
                endBuildId = tl.getInput("jenkinsBuildNumber", false)
            }

            console.log(tl.loc("JenkinsDownloadingChangeFromCurrentBuild", endBuildId));

            commitsDownloader.DownloadFromSingleBuildAndSave(endBuildId).then((commits: string) => {
                    let commitMessages: string[] = CommitsDownloader.GetCommitMessagesFromCommits(commits);
                    let workItemsDownloader: WorkItemsDownloader = new WorkItemsDownloader(commitMessages); 
                    workItemsDownloader.DownloadFromSingleBuildAndSave(endBuildId).then(() => {
                        defer.resolve(null);
                    }, (error) => {
                        defer.reject(error);
                    });
            }, (error) => {
                defer.reject(error);
            });
        }
        else {
            let endBuildId: number = parseInt(tl.getInput("jenkinsBuildNumber", true));
            
            if (isNaN(endBuildId) || !endBuildId) {
                defer.reject(new Error(tl.loc("InvalidJenkinsBuildNumber")));
                return defer.promise;
            }

            if (startBuildId < endBuildId) {
                console.log(tl.loc("DownloadingJenkinsChangeBetween", startBuildId, endBuildId));
            }
            else if (startBuildId > endBuildId) {
                console.log(tl.loc("JenkinsRollbackDeployment", startBuildId, endBuildId));

                // swap the Build IDs to fetch the roll back commits
                let temp: number = startBuildId;
                startBuildId = endBuildId;
                endBuildId = temp;
            }
            else if (startBuildId == endBuildId) {
                console.log(tl.loc("JenkinsNoCommitsToFetch"));
                defer.resolve(null);
                return defer.promise;
            }

            // #1. Since we have two builds, we need to figure the build index
            this.GetBuildIdIndex(startBuildId, endBuildId).then((buildIndex) => {
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

    private GetBuildIdIndex(startBuildId: number, endBuildId: number): Q.Promise<any> {
        let defer = Q.defer<any>();
        let buildUrl: string = "/api/json?tree=allBuilds[number]";
        let startIndex: number = 0;
        let endIndex: number = 0;

        console.log(tl.loc("FindBuildIndex"));
        handlebars.registerHelper('BuildIndex', function(buildId, index, options) {
            if (buildId == startBuildId) {
                startIndex = index;
            } else if (buildId == endBuildId) {
                endIndex = index;
            }

            return options.fn(this);
        });

        let source: string = '{{#each allBuilds}}{{#BuildIndex this.number @index}}{{/BuildIndex}}{{/each}}';
        let downloadHelper: JenkinsRestClient = new JenkinsRestClient();
        downloadHelper.DownloadJsonContent(buildUrl, source, null).then(() => {
            console.log(tl.loc("FoundBuildIndex", startIndex, endIndex));
            if (startIndex === 0 || endIndex === 0) {
                tl.debug(`cannot find valid startIndex ${startIndex} or endIndex ${endIndex}`);
                defer.reject(tl.loc("CannotFindBuilds"));
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
