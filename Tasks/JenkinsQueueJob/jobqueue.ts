// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');

import { Job, JobState } from './job';
import { JobSearch } from './jobsearch';
import { TaskOptions } from './jenkinsqueuejobtask';

import util = require('./util');

export class JobQueue {
    public TaskOptions: TaskOptions;

    public RootJob: Job;
    private allJobs: Job[] = [];
    private searches: JobSearch[] = [];

    constructor(taskOptions: TaskOptions) {
        this.TaskOptions = taskOptions;
    }

    private intervalId: NodeJS.Timer;
    private intervalMillis: number = 100;

    public Start(): void {
        tl.debug('jobQueue.start()');
        this.intervalId = setInterval(() => {
            try {
                const nextSearches: JobSearch[] = this.findNextJobSearches();
                for (const i in nextSearches) {
                    nextSearches[i].DoWork();
                }

                const running: Job[] = this.findRunningJobs();
                for (const i in running) {
                    running[i].DoWork();
                }
                if (this.hasFailedJobs()) {
                    this.stop(false);
                } else if (this.getActiveJobs().length === 0) {
                    this.stop(true);
                } else {
                    this.FlushJobConsolesSafely();
                }
            } catch (err) {
                tl.debug(err.message);
                tl.setResult(tl.TaskResult.Failed, err.message);
                this.stop(false);
            }
        }, this.intervalMillis);
    }

    private stop(complete: boolean): void {
        tl.debug('jobQueue.stop()');
        clearInterval(this.intervalId);
        this.FlushJobConsolesSafely();
        this.writeFinalMarkdown(complete);
    }

    private hasFailedJobs(): boolean {
        for (const i in this.allJobs) {
            const job: Job = this.allJobs[i];
            if (job.State === JobState.Done) {
                if (job.GetTaskResult() === tl.TaskResult.Failed) {
                    return true;
                }
            }
        }
        return false;
    }

    private findRunningJobs(): Job[] {
        const running: Job[] = [];
        for (const i in this.allJobs) {
            const job: Job = this.allJobs[i];
            if (job.State === JobState.Streaming || job.State === JobState.Downloading || job.State === JobState.Finishing) {
                running.push(job);
            }
        }
        return running;
    }

    private findNextJobSearches(): JobSearch[] {
        const nextSearches: JobSearch[] = [];
        for (const i in this.allJobs) {
            const job = this.allJobs[i];
            // the parent must be finished (or null for root) in order for a job to possibly be started
            if (job.State === JobState.Locating && (job.Parent === null || job.Parent.State === JobState.Done)) {
                // group these together so only search is done per job.identifier
                if (!nextSearches[job.Identifier]) {
                    nextSearches[job.Identifier] = this.searches[job.Identifier];
                }
                nextSearches[job.Identifier].searchFor(job);
            }
        }
        return nextSearches;
    }

    private getActiveJobs(): Job[] {
        const active: Job[] = [];

        for (const i in this.allJobs) {
            const job = this.allJobs[i];
            if (job.IsActive()) {
                active.push(job);
            }
        }

        return active;
    }

    public AddJob(job: Job) {
        if (this.allJobs.length === 0) {
            this.RootJob = job;
        }
        this.allJobs.push(job);
        if (this.searches[job.Identifier] == null) {
            this.searches[job.Identifier] = new JobSearch(this, job.TaskUrl, job.Identifier);
        }
        job.Search = this.searches[job.Identifier];
    }

    public FlushJobConsolesSafely(): void {
        if (this.FindActiveConsoleJob() == null) { //nothing is currently writing to the console
            const streamingJobs: Job[] = [];
            let addedToConsole: boolean = false;
            for (const i in this.allJobs) {
                const job: Job = this.allJobs[i];
                if (job.State === JobState.Done) {
                    if (!job.IsConsoleEnabled()) {
                        job.EnableConsole(); // flush the finished ones
                        addedToConsole = true;
                    }
                } else if (job.State === JobState.Streaming || job.State === JobState.Finishing) {
                    streamingJobs.push(job); // these are the ones that could be running
                }
            }
            // finally, if there is only one remaining, it is safe to enable its console
            if (streamingJobs.length === 1) {
                streamingJobs[0].EnableConsole();
            } else if (addedToConsole) {
                for (const i in streamingJobs) {
                    const job: Job = streamingJobs[i];
                    console.log('Jenkins job pending: ' + job.ExecutableUrl);
                }
            }
        }
    }

    /**
     * If there is a job currently writing to the console, find it.
     */
    public FindActiveConsoleJob(): Job {
        const activeJobs: Job[] = this.getActiveJobs();
        for (const i in activeJobs) {
            const job: Job = activeJobs[i];
            if (job.IsConsoleEnabled()) {
                return job;
            }
        }
        return null;
    }

    public FindJob(identifier: string, executableNumber: number): Job {
        for (const i in this.allJobs) {
            const job: Job = this.allJobs[i];
            if (job.Identifier === identifier && job.ExecutableNumber === executableNumber) {
                return job;
            }
        }
        return null;
    }

    private writeFinalMarkdown(complete: boolean): void {
        const colorize: Function = (s) => {
            // 'Success' is green, everything else is red
            let color: string = 'red';
            if (s === tl.loc('succeeded')) {
                color = 'green';
            }

            return `<font color='${color}'>${s}</font>`;
        };

        function walkHierarchy(job: Job, indent: string, padding: number): string {
            let jobContents: string = indent + '<ul style="padding-left:' + padding + '">\n';

            // if this job was joined to another follow that one instead
            job = findWorkingJob(job);

            if (job.ExecutableNumber === -1) {
                jobContents += indent + job.Name + ' ' + colorize(job.GetResultString()) + '<br />\n';
            } else {
                const url = job.ExecutableUrl && job.ExecutableUrl.replace('"', '%22');
                jobContents += indent + '<a href="' + url + '">' + job.Name + ' #' + job.ExecutableNumber + '</a> ' + colorize(job.GetResultString()) + '<br />\n';
            }

            let childContents: string = '';
            for (const i in job.Children) {
                const child: Job = job.Children[i];
                childContents += walkHierarchy(child, indent + tab, padding + paddingTab);
            }
            return jobContents + childContents + indent + '\n</ul>\n';
        }

        function findWorkingJob(job: Job): Job {
            if (job.State !== JobState.Joined) {
                return job;
            } else {
                return findWorkingJob(job.Joined);
            }
        }

        function createPipelineReport(job: Job, taskOptions: TaskOptions, report): string {
            const authority: string = util.getUrlAuthority(job.ExecutableUrl);

            const getStageUrl: Function = (authority, stage) => {
                let result: string = '';
                if (stage && stage['_links']
                          && stage['_links']['self']
                          && stage['_links']['self']['href']) {
                    result = stage['_links']['self']['href'];
                    //remove the api link
                    result = result.replace('/wfapi/describe', '');
                }

                return `${authority}${result}`;
            };

            const convertStatus: Function = (s) => {
                let status: string = s.toLowerCase();
                if (status === 'success') {
                    status = tl.loc('succeeded');
                }
                return status;
            };

            // Top level pipeline job status
            let jobContent: string = '<ul style="padding-left: 0">';
            let jobName: string = taskOptions.jobName;
            if (taskOptions.isMultibranchPipelineJob) {
                jobName = `${jobName}/${taskOptions.multibranchPipelineBranch}`;
            }
            jobContent += '[' + jobName + ' #' + job.ExecutableNumber + '](' + job.ExecutableUrl + ') ' + colorize(job.GetResultString());
            if (job.GetResultString() !== tl.loc('succeeded')) {
                jobContent += ` ([${tl.loc('console')}](${job.ExecutableUrl}/console))`;
            }
            jobContent += '<br />';

            // For each stage, write its status
            let stageContents: string = '';
            for (let stage of report['stages']) {
                const stageUrl: string = getStageUrl(authority, stage);
                stageContents += '[' + stage['name'] + '](' + stageUrl + ') ' + colorize(convertStatus(stage.status)) + '<br />';
            }

            if (stageContents) {
                jobContent += '<ul style="padding-left: 4">\n';
                jobContent += stageContents;
                jobContent += '</ul>';
            }

            //close out the element for the entire job
            jobContent += '</ul>';
            return jobContent;
        }

        function generatePipelineReport(job: Job, taskOptions: TaskOptions, callback: (pipelineReport: string) => void): void {
            util.getPipelineReport(job, taskOptions)
                .then((body) => {
                    if (body) {
                        const parsedBody: any = JSON.parse(body);
                        callback(createPipelineReport(job, taskOptions, parsedBody));
                    } else {
                        callback(tl.loc('FailedToGenerateSummary'));
                    }
                });
        }

        function generateMarkdownContent(job: Job, taskOptions: TaskOptions, callback: (markdownContent: string) => void): void {
            util.isPipelineJob(job, taskOptions)
                .then((isPipeline) => {
                    if (isPipeline) {
                        generatePipelineReport(job, taskOptions, callback);
                    } else {
                        callback(walkHierarchy(job, '', 0));
                    }
                });
        }

        tl.debug('writing summary markdown');
        const thisQueue: JobQueue = this;
        const tempDir: string = shell.tempdir();
        const linkMarkdownFile: string = path.join(tempDir, 'JenkinsJob_' + this.RootJob.Name + '_' + this.RootJob.ExecutableNumber + '.md');
        tl.debug('markdown location: ' + linkMarkdownFile);
        const tab: string = '  ';
        const paddingTab: number = 4;
        generateMarkdownContent(this.RootJob, thisQueue.TaskOptions, (markdownContents) => {
            fs.writeFile(linkMarkdownFile, markdownContents, function callback(err) {
                tl.debug('writeFinalMarkdown().writeFile().callback()');

                if (err) {
                    //don't fail the build -- there just won't be a link
                    console.log('Error creating link to Jenkins job: ' + err);
                } else {
                    console.log('##vso[task.addattachment type=Distributedtask.Core.Summary;name=Jenkins Results;]' + linkMarkdownFile);
                }

                let message: string = null;
                if (complete) {
                    if (thisQueue.TaskOptions.capturePipeline) {
                        message = tl.loc('JenkinsPipelineComplete');
                    } else if (thisQueue.TaskOptions.captureConsole) {
                        message = tl.loc('JenkinsJobComplete');
                    } else {
                        message = tl.loc('JenkinsJobQueued');
                    }
                    tl.setResult(tl.TaskResult.Succeeded, message);
                } else {
                    if (thisQueue.TaskOptions.capturePipeline) {
                        message = tl.loc('JenkinsPipelineFailed');
                    } else if (thisQueue.TaskOptions.captureConsole) {
                        message = tl.loc('JenkinsJobFailed');
                    } else {
                        message = tl.loc('JenkinsJobFailedtoQueue');
                    }
                    tl.setResult(tl.TaskResult.Failed, message);
                }
            });
        });
    }
}
