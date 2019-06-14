import * as Q from 'q';
import * as  tl from 'azure-pipelines-task-lib/task';

import {JenkinsRestClient, JenkinsJobDetails} from "./JenkinsRestClient"
import {CommitsDownloader} from "./CommitsDownloader"
import {WorkItemsDownloader} from "./WorkItemsDownloader"

var handlebars = require('handlebars');

export class ArtifactDetailsDownloader {
    public DownloadCommitsAndWorkItems(jenkinsJobDetails: JenkinsJobDetails): Q.Promise<void> {
        let defer: Q.Deferred<any> = Q.defer<any>();

        console.log(tl.loc("DownloadingCommitsAndWorkItems"));

        let jenkinsBuild = tl.getInput('jenkinsBuild', true);
        let startBuildIdStr: string = tl.getInput("startJenkinsBuildNumber", false) || "";
        let startBuildId: number = this.GetBuildIdFromVersion(startBuildIdStr, jenkinsJobDetails.isMultiBranchPipeline);
        let endBuildId: number = jenkinsJobDetails.buildId;
        let commitsDownloader: CommitsDownloader = new CommitsDownloader();
            
        // validate endBuildId which is a mandatory parameter
        if (isNaN(endBuildId) || !endBuildId) {
            defer.reject(new Error(tl.loc("InvalidJenkinsBuildNumber")));
            return defer.promise;
        }

        // validate the start build only if its required.
        if (startBuildIdStr.trim().length > 0 && isNaN(startBuildId) && jenkinsBuild !== 'LastSuccessfulBuild') {
            defer.reject(new Error(tl.loc("InvalidJenkinsStartBuildNumber", startBuildIdStr)));
            return defer.promise;
        }

        // if you have a valid start and end buildId and then switch to LastSuccessfulBuild
        //  previous start build still exists though its not visible. Hence check the jenkinsBuild input 
        //  and if its set to LastSuccessfulBuild consider startBuild is not mentioned.
        if (!startBuildId || isNaN(startBuildId) || jenkinsBuild === 'LastSuccessfulBuild') {
            console.log(tl.loc("JenkinsDownloadingChangeFromCurrentBuild", jenkinsJobDetails.buildId));
            commitsDownloader.DownloadFromSingleBuildAndSave(jenkinsJobDetails).then((commits: string) => {
                    let commitMessages: string[] = CommitsDownloader.GetCommitMessagesFromCommits(commits);
                    let workItemsDownloader: WorkItemsDownloader = new WorkItemsDownloader(commitMessages); 
                    workItemsDownloader.DownloadFromSingleBuildAndSave(jenkinsJobDetails).then(() => {
                        defer.resolve(null);
                    }, (error) => {
                        defer.reject(error);
                    });
            }, (error) => {
                defer.reject(error);
            });
        }
        else {
            if (jenkinsJobDetails.isMultiBranchPipeline) {
                // if multibranch validate if the branch names are same.
                let startBuildBranchName: string = this.GetBranchNameFromVersion(startBuildIdStr, jenkinsJobDetails.isMultiBranchPipeline);

                if (startBuildBranchName.toLowerCase() !== jenkinsJobDetails.multiBranchPipelineName.toLowerCase()) {
                    defer.reject(new Error(tl.loc("InvalidMultiBranchPipelineName", startBuildBranchName, jenkinsJobDetails.multiBranchPipelineName)));
                    return defer.promise;
                }
            }

            if (startBuildId < endBuildId) {
                console.log(tl.loc("DownloadingJenkinsChangeBetween", startBuildId, endBuildId));
            }
            else if (startBuildId > endBuildId) {
                console.log(tl.loc("DownloadingJenkinsChangeBetween", endBuildId, startBuildId));
                tl.debug(`Start build ${startBuildId} is greater than end build ${endBuildId}`);

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
            this.GetBuildIdIndex(jenkinsJobDetails, startBuildId, endBuildId).then((buildIndex) => {
                let startIndex: number = buildIndex['startIndex'];
                let endIndex: number = buildIndex['endIndex'];

                //#2. Download the commits using range and save
                commitsDownloader.DownloadFromBuildRangeAndSave(jenkinsJobDetails, startIndex, endIndex).then((commits: string) => {
                    //#3. download workitems
                    let commitMessages: string[] = CommitsDownloader.GetCommitMessagesFromCommits(commits);
                    let workItemsDownloader: WorkItemsDownloader = new WorkItemsDownloader(commitMessages); 
                    workItemsDownloader.DownloadFromBuildRangeAndSave(jenkinsJobDetails, startIndex, endIndex).then(() => {
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

    private GetBuildIdFromVersion(version: string, isMultiBranchPipeline: boolean): number {
        let buildId: number = NaN;

        if (!!version) {
            if (!isMultiBranchPipeline) {
                buildId = parseInt(version);
            }
            else {
                buildId = parseInt(version.substring(version.lastIndexOf(JenkinsRestClient.JenkinsBranchPathSeparator) + 1));
            }
        }

        return buildId;
    }

    private GetBranchNameFromVersion(version: string, isMultibranchPipeline: boolean): string {
        let branchName: string = version;

        if (!!version && isMultibranchPipeline) {
            branchName = version.substring(0, version.lastIndexOf(JenkinsRestClient.JenkinsBranchPathSeparator));
        }

        return branchName;
    }

    private GetBuildIdIndex(jenkinsJobDetails: JenkinsJobDetails, startBuildId: number, endBuildId: number): Q.Promise<any> {
        let defer = Q.defer<any>();
        let buildUrl: string = `${jenkinsJobDetails.multiBranchPipelineUrlInfix}/api/json?tree=allBuilds[number]`;
        let startIndex: number = -1;
        let endIndex: number = -1;

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
            if (startIndex === -1 || endIndex === -1) {
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
