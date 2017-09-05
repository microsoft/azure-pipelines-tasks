var path = require('path')
var url = require('url')
var fs = require('fs')
var helpers = require('handlebars-helpers')(['array']);

import * as Q from 'q';
import * as  tl from 'vsts-task-lib/task';

var request = require('request');
var handlebars = require('handlebars');

const CommitsDataVersion: number = 1;
const ReleaseTempDirectoryPrefix: string = 't'
const ArtifactDetailsDirectoryPrefix: string = 'a';

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

const WorkItemTemplateBase: string = `{{#with (lookupAction actions 'issues') as |action|}}
{{#each action.issues}}
{{#containsInArray @root.commits key}}
  {
    "id": "{{key}}",
    "title": "{{summary}}",
    {{#if assignee}}
    "assignee": "{{assignee}}",
    {{/if}}
    {{#if status}}
    "status": "{{status}}",
    {{/if}}
    {{#if type}}
    "type": "{{type}}",
    {{/if}}
    "url": "{{#chopTrailingSlash ../serverURL}}{{/chopTrailingSlash}}/browse/{{key}}"
  },
{{/containsInArray}}
{{/each}}
{{/with}}`;

const WorkItemTemplate: string = `[
    ${WorkItemTemplateBase}
]`;

const WorkItemsTemplate: string = `[
  {{#each (lookup . buildParameter)}}
  {{> workitem this}}
  {{/each}}
]`;

export class ArtifactDetailsDownloader {
    private commitsPartialTemplate: string = '';

    constructor() {
        this.RegisterCustomerHandleBars();
    }

    public DownloadCommitsAndWorkItems(): Q.Promise<void> {
        let defer: Q.Deferred<any> = Q.defer<any>();

        console.log(tl.loc("DownloadingCommitsAndWorkItems"));
        let endJobId: number = parseInt(tl.getInput("version", true));
        let startJobId: number = parseInt(tl.getInput("previousJenkinsJob"))

        let commitsFileName: string = this.GetCommitsFileName();
        let tempCommitsFilePath: string = path.join("d:\\"/*tl.getVariable('agent.releaseRootDirectory')*/, commitsFileName);

        let workItemsFileName: string = this.GetWorkItemsFileName();
        let workItemsFilePath: string = path.join("d:\\"/*tl.getVariable('agent.releaseRootDirectory')*/, workItemsFileName);

        if (!startJobId) {
            console.log(tl.loc("JenkinsDownloadingChangeFromCurrentBuild", endJobId));

            this.DownloadCommitsFromSingleBuildAndSave(endJobId, tempCommitsFilePath).then((commits: string) => {
                    let commitMessages: string[] = this.GetCommitMessagesFromCommits(commits);
                    this.DownloadWorkItemsFromSingleBuildAndSave(endJobId, commitMessages, workItemsFilePath).then(() => {
                        defer.resolve(null);
                    }, (error) => {
                        defer.reject(error);
                    });
            }, (error) => {
                defer.reject(error);
            });
        }
        else {
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
                return;
            }

            // #1. Since we have two builds, we need to figure the build index
            this.GetJobIdIndex(startJobId, endJobId).then((buildIndex) => {
                let startIndex: number = buildIndex['startIndex'];
                let endIndex: number = buildIndex['endIndex'];

                //#2. Download the commits using range and save
                this.DownloadCommitsFromBuildRangeAndSave(startIndex, endIndex, tempCommitsFilePath).then((commits: string) => {
                    //#3. download workitems
                    let commitMessages: string[] = this.GetCommitMessagesFromCommits(commits);
                    this.DownloadWorkItemsFromBuildRangeAndSave(startIndex, endIndex, commitMessages, workItemsFilePath).then(() => {
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

    private GetWorkItemsFileName(): string {
        let fileName: string = "workitems.json";
        let workItemsfileName: string = tl.getInput("artifactDetailsFileNameSuffix", false);

        if (workItemsfileName) {
            fileName = `workitems_${workItemsfileName}`;
        }

        return fileName;
    }

// --- start:common helpers------------------------------------------------------------------------------------//
    private UploadAttachment(content: string, filePath: string): Q.Promise<any> {
        let defer = Q.defer<void>();

        fs.writeFile(filePath, content, (err) => {
            if (err) {
                console.log(`could not save the content to the file. Failed with an error ${err}`);
                defer.reject(err);
                return;
            }

            console.log(`uploading ${filePath} as attachment`);
            console.log(`##vso[task.uploadfile]${filePath}`);
            defer.resolve(null);
        });

        return defer.promise;
    }

    private GetJobIdIndex(startJobId, endJobId): Q.Promise<any> {
        let defer = Q.defer<any>();
        let jobUrl: string = "/api/json?tree=allBuilds[number]";
        let startIndex: number = 0;
        let endIndex: number = 0;

        console.log("Trying to find the build's index");
        handlebars.registerHelper('JobIndex', function(jobId, index, options) {
            if(jobId == startJobId) {
                startIndex = index;
            } else if (jobId == endJobId) {
                endIndex = index;
            }

            return options.fn(this);
        });

        let source: string = '{{#each allBuilds}}{{#JobIndex this.number @index}}{{/JobIndex}}{{/each}}';
        this.DownloadJsonContent(jobUrl, source).then(() => {
            console.log(`Found startIndex ${startIndex} and endIndex ${endIndex}`);
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

    private DownloadJsonContent(urlPath: string, handlebarSource: string, additionalContext: { [key: string]: any } = null): Q.Promise<any> {
        let defer = Q.defer<any>();

        const connection = tl.getInput("connection", true);
        const endpointUrl = tl.getEndpointUrl(connection, false);
        const jobName = tl.getInput("definition", true);
        const username = tl.getEndpointAuthorizationParameter(connection, 'username', false);
        const password = tl.getEndpointAuthorizationParameter(connection, 'password', false);
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(connection, 'acceptUntrustedCerts', true));

        let requestUrl: string = `${endpointUrl}/job/${jobName}/${urlPath}`;
        console.log('Downloading content form Jenkins server:' + requestUrl + ' with strict SSL:' + strictSSL);

        request.get({url: requestUrl, strictSSL: strictSSL}, (err, res, body) => {
            if (res && body && res.statusCode === 200)  {
                tl.debug(`Content received from server ${body}`);
                let jsonResult = JSON.parse(body);

                if (!handlebarSource) {
                    defer.resolve(jsonResult);
                }
                else {
                    try {
                        tl.debug(`Applying the handlbar source ${handlebarSource} on the result`);
                        let template = handlebars.compile(handlebarSource);
                        if (additionalContext) {
                            for(let key in additionalContext) {
                            tl.debug(`Adding additional context {${key} --> ${additionalContext[key]}} to the original context`)
                                jsonResult[key] = additionalContext[key];
                            };
                        }

                        var result = template(jsonResult);
                        defer.resolve(result);
                    }
                    catch(err) {
                        tl.debug(`handlebar failed with an error ${err}`);
                        defer.reject(err)
                    }
                }
            }
            else {
                if (res && res.statusCode) {
                    tl.debug(tl.loc('ServerCallErrorCode', res.statusCode));
                }

                if (body) {
                    tl.debug(body);
                }

                defer.reject(new Error(tl.loc('ServerCallFailed')));
            }
        }).auth(username, password, true);

        return defer.promise;
    }

    private RegisterCustomerHandleBars(): void {
        handlebars.registerHelper('CaseIgnoreEqual', function(lhs, rhs, options) {
            if (!lhs && !rhs) {
                return options.fn(this);
            }

            if ((lhs && !rhs) || (!lhs && rhs)) {
                return options.inverse(this);
            }
            
            if (lhs.toUpperCase() != rhs.toUpperCase()) {
                return options.inverse(this);                    
            }
            else {
                return options.fn(this);
            }
        });

        handlebars.registerHelper('lookupAction', function(list, key, options) {
            if (!!list) {
                for (let i = 0, len = list.length; i < len; i++) {
                    if (list[i][key]) {
                        return list[i];
                    }
                }
            }

            return null;
        });

        handlebars.registerHelper('containsInArray', function(array, value, options) {
            if (!!array) {
                for(let i = 0, len = array.length; i < len; i++) {
                    tl.debug(`checking ${array[i]} ${value}`);
                    if (!!array[i] && array[i].indexOf(value) > -1) {
                        return options.fn(this);
                    }
                }
            }

            return options.inverse(this);
        });

        handlebars.registerHelper('chopTrailingSlash', function(value, options) {
            var result: any = value;
            if (!!value && value.substr(-1) === '/') {
                tl.debug(`chop chop ${value} ${value.length - 1}`);    
                result = value.substr(0, value.length - 1)
            }
            tl.debug(`chop chop ${result}`);

            return result;
        });
        
        // handlebars.registerHelper('pluck', function(arr, prop) {
        //     let res = [];

        //     if (!!arr && !!prop) {
        //         for (let i = 0, len = arr.length; i < len; i++) {
        //             let val = arr[i][prop];
        //             if (typeof val !== 'undefined') {
        //                 res.push(`"${val}"`);
        //             }
        //         }
        //     }

        //     return res;
        // });

        // handlebars.registerHelper('mylookup', function(context, item) {
        //     for(var property in context) {
        //         tl.debug('context: ' + property + "=" + context[property]);
        //     }
        //     return context[item];
        // });

        handlebars.registerPartial('commit', CommitTemplateBase);
        handlebars.registerPartial('workitem', WorkItemTemplateBase);
    }

    
// --- end:common helpers------------------------------------------------------------------------------------//

// --- start:commits helpers------------------------------------------------------------------------------------//
    private GetCommits(startIndex: number, endIndex: number): Q.Promise<string> {
        let defer = Q.defer<string>();

        const buildParameter: string = (startIndex >= 100 || endIndex >= 100) ? "allBuilds" : "builds"; // jenkins by default will return only 100 top builds. Have to use "allBuilds" if we are dealing with build which are older than 100 builds
        const commitsUrl: string = `/api/json?tree=${buildParameter}[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{${endIndex},${startIndex}}`;

        console.log('Downloading commits');
        this.DownloadJsonContent(commitsUrl, CommitsTemplate, {'buildParameter': buildParameter}).then((commitsResult) => {
            tl.debug(`Processed commits ${commitsResult}`);
            defer.resolve(commitsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFromSingleBuild(jobId: number): Q.Promise<string> {
        let defer = Q.defer<string>();

        const commitsUrl: string = `/${jobId}/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]`;

        console.log(`Downloading commits from the job ${jobId}`);
        this.DownloadJsonContent(commitsUrl, commitTemplate).then((commitsResult) => {
            tl.debug(`Processed commits ${commitsResult}`);
            defer.resolve(commitsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private DownloadCommitsFromSingleBuildAndSave(jobId: number, commitsFilePath: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        console.log(`Getting commits associated with the build ${jobId}`);
        this.GetCommitsFromSingleBuild(jobId).then((commits: string) => {
            this.UploadCommits(commits, commitsFilePath).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        })        

        return defer.promise;
    }

    private DownloadCommitsFromBuildRangeAndSave(startIndex: number, endIndex: number, commitsFilePath: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetCommits(startIndex, endIndex).then((commits: string) => {
            this.UploadCommits(commits, commitsFilePath).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
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

    private GetCommitMessagesFromCommits(commits: string): string[] {
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

    private GetCommitsFileName(): string {
        let fileName: string = "commits.json";
        let commitfileName: string = tl.getInput("artifactDetailsFileNameSuffix", false);

        if (commitfileName) {
            fileName = `commits_${commitfileName}`;
        }

        return fileName;
    }
// --- end:commits helpers------------------------------------------------------------------------------------//

// --- start:workitems helpers------------------------------------------------------------------------------------//
    private DownloadWorkItemsFromSingleBuildAndSave(jobId: number, commitMessages: string[], workItemsFilePath: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        console.log(`Getting workitems associated with the build ${jobId}`);
        this.GetWorkItemsFromSingleBuild(jobId, commitMessages).then((workItems: string) => {
            this.UploadWorkItems(workItems, workItemsFilePath).then(() => {
                defer.resolve(null);
            }, (error) => {
                defer.reject(error);
            });
        })        

        return defer.promise;
    }

    private DownloadWorkItemsFromBuildRangeAndSave(startIndex: number, endIndex: number, commitsMessage: string[], workItemsFilePath: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetWorkItems(startIndex, endIndex, commitsMessage).then((workItems: string) => {
            this.UploadWorkItems(workItems, workItemsFilePath).then(() => {
                defer.resolve(workItems);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetWorkItemsFromSingleBuild(jobId: number, commitMessages: string[]): Q.Promise<string> {
        let defer = Q.defer<string>();

        const workItemsUrl: string = `/${jobId}/api/json?tree=actions[issues[*],serverURL]`;

        console.log(`Downloading workItems from the job ${jobId}`);
        this.DownloadJsonContent(workItemsUrl, WorkItemTemplate, {'commits':commitMessages}).then((workItemsResult) => {
            tl.debug(`Processed workItems ${workItemsResult}`);
            defer.resolve(workItemsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
 
    private GetWorkItems(startIndex: number, endIndex: number, commitMessages: string[]): Q.Promise<string> {
        let defer = Q.defer<string>();

        const buildParameter: string = (startIndex >= 100 || endIndex >= 100) ? "allBuilds" : "builds"; // jenkins by default will return only 100 top builds. Have to use "allBuilds" if we are dealing with build which are older than 100 builds
        const workItemsUrl: string = `/api/json?tree=${buildParameter}[actions[issues[*],serverURL]]{${endIndex},${startIndex}}`;

        console.log('Downloading workitems');
        this.DownloadJsonContent(workItemsUrl, WorkItemsTemplate, {'buildParameter': buildParameter, 'commits':commitMessages}).then((workItemsResult) => {
            tl.debug(`Processed workitems ${workItemsResult}`);
            defer.resolve(workItemsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private UploadWorkItems(workItems: string, workItemsFilePath: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        console.log(`Writing workitems to ${workItemsFilePath}`);
        this.UploadAttachment(workItems, workItemsFilePath).then(() => {
            console.log('uploaded work item attachment');
            defer.resolve(null);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}
