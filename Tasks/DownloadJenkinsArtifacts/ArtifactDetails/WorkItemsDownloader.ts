import * as Q from 'q';
import * as os from 'os';
import * as path from 'path';
import * as  tl from 'vsts-task-lib/task';

import {ArtifactDetailsDownloaderBase} from "./ArtifactDetailsDownloaderBase"
import {DownloadHelper} from "./DownloadHelper"

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
    private downloadHelper: DownloadHelper;
    private commitMessages: string[];
    private workItemsFilePath: string;

    constructor(commitMessages: string[]) {
        super();

        this.commitMessages = commitMessages;

        let tempDir: string = os.tmpdir();
        let workItemsFileName: string = this.GetWorkItemsFileName();
        this.workItemsFilePath = path.join(/*"d:\\"*/tempDir, workItemsFileName);

        handlebars.registerPartial('workitem', WorkItemTemplateBase);
        this.downloadHelper = new DownloadHelper();
    }

    public DownloadFromSingleBuildAndSave(jobId: number): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        console.log(`Getting workitems associated with the build ${jobId}`);
        this.GetWorkItemsFromSingleBuild(jobId, this.commitMessages).then((workItems: string) => {
            this.UploadWorkItems(workItems, this.workItemsFilePath).then(() => {
                defer.resolve(null);
            }, (error) => {
                defer.reject(error);
            });
        })        

        return defer.promise;
    }

    public DownloadFromBuildRangeAndSave(startIndex: number, endIndex: number): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        this.GetWorkItems(startIndex, endIndex, this.commitMessages).then((workItems: string) => {
            this.UploadWorkItems(workItems, this.workItemsFilePath).then(() => {
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
        this.downloadHelper.DownloadJsonContent(workItemsUrl, WorkItemTemplate, {'commits':commitMessages}).then((workItemsResult) => {
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
        this.downloadHelper.DownloadJsonContent(workItemsUrl, WorkItemsTemplate, {'buildParameter': buildParameter, 'commits':commitMessages}).then((workItemsResult) => {
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

    private GetWorkItemsFileName(): string {
        let fileName: string = "workitems.json";
        let workItemsfileName: string = tl.getInput("artifactDetailsFileNameSuffix", false);

        if (workItemsfileName) {
            fileName = `workitems_${workItemsfileName}`;
        }

        return fileName;
    }
}