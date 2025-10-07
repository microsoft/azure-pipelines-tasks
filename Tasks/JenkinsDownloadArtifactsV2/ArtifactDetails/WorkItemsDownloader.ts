import * as Q from 'q';
import * as os from 'os';
import * as path from 'path';
import * as  tl from 'azure-pipelines-task-lib/task';

import {ArtifactDetailsDownloaderBase} from "./ArtifactDetailsDownloaderBase"
import {JenkinsRestClient, JenkinsJobDetails} from "./JenkinsRestClient"

var handlebars = require('handlebars');

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

export class WorkItemsDownloader extends ArtifactDetailsDownloaderBase {
    private jenkinsClient: JenkinsRestClient;
    private commitMessages: string[];

    constructor(commitMessages: string[]) {
        super();

        this.commitMessages = commitMessages;

        handlebars.registerPartial('workitem', WorkItemTemplateBase);
        this.jenkinsClient = new JenkinsRestClient();
    }

    public DownloadFromSingleBuildAndSave(jenkinsJobDetails: JenkinsJobDetails): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        console.log(tl.loc("DownloadingWorkItemsFromSingleBuild", jenkinsJobDetails.buildId));
        this.GetWorkItemsFromSingleBuild(jenkinsJobDetails, this.commitMessages).then((workItems: string) => {
            this.UploadWorkItems(workItems).then(() => {
                defer.resolve(null);
            }, (error) => {
                defer.reject(error);
            });
        })        

        return defer.promise;
    }

    public DownloadFromBuildRangeAndSave(jenkinsJobDetails: JenkinsJobDetails, startIndex: number, endIndex: number): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetWorkItems(jenkinsJobDetails, startIndex, endIndex, this.commitMessages).then((workItems: string) => {
            this.UploadWorkItems(workItems).then(() => {
                defer.resolve(workItems);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetWorkItemsFromSingleBuild(jenkinsJobDetails: JenkinsJobDetails, commitMessages: string[]): Q.Promise<string> {
        let defer = Q.defer<string>();

        const workItemsUrl: string = `${jenkinsJobDetails.multiBranchPipelineUrlInfix}/${jenkinsJobDetails.buildId}/api/json?tree=actions[issues[*],serverURL]`;
        this.jenkinsClient.DownloadJsonContent(workItemsUrl, WorkItemTemplate, {'commits':commitMessages}).then((workItemsResult) => {
            tl.debug(`Downloaded workItems: ${workItemsResult}`);
            defer.resolve(workItemsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
 
    private GetWorkItems(jenkinsJobDetails: JenkinsJobDetails, startIndex: number, endIndex: number, commitMessages: string[]): Q.Promise<string> {
        let defer = Q.defer<string>();

        const buildParameter: string = (startIndex >= 100 || endIndex >= 100) ? "allBuilds" : "builds"; // jenkins by default will return only 100 top builds. Have to use "allBuilds" if we are dealing with build which are older than 100 builds
        const workItemsUrl: string = `${jenkinsJobDetails.multiBranchPipelineUrlInfix}/api/json?tree=${buildParameter}[actions[issues[*],serverURL]]{${endIndex},${startIndex}}`;

        tl.debug(`Downloading workItems from startIndex ${startIndex} and endIndex ${endIndex}`);
        this.jenkinsClient.DownloadJsonContent(workItemsUrl, WorkItemsTemplate, {'buildParameter': buildParameter, 'commits':commitMessages}).then((workItemsResult) => {
            tl.debug(`Downloaded workItems: ${workItemsResult}`);
            defer.resolve(workItemsResult);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private UploadWorkItems(workItems: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();
        let workItemsFilePath = path.join(os.tmpdir(), this.GetWorkItemsFileName());

        console.log(tl.loc("WritingWorkItemsTo", workItemsFilePath));
        this.WriteContentToFileAndUploadAsAttachment(workItems, workItemsFilePath).then(() => {
            console.log(tl.loc("SuccessfullyUploadedWorkItemsAttachment"));
            defer.resolve(null);
        }, (error) => {
            defer.reject(error);
        });

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
}