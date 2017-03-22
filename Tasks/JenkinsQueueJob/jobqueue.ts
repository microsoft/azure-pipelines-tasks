
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');

// node js modules
import task = require('./jenkinsqueuejobtask');
import TaskOptions = task.TaskOptions;

import job = require('./job');
import Job = job.Job;
import JobState = job.JobState;

import jobsearch = require('./jobsearch');
import JobSearch = jobsearch.JobSearch;

import util = require('./util');

export class JobQueue {
    taskOptions: TaskOptions;

    rootJob: Job;
    allJobs: Job[] = [];
    searches: JobSearch[] = [];

    constructor(taskOptions: TaskOptions) {
        this.taskOptions = taskOptions;
    }

    intervalId: NodeJS.Timer;
    intervalMillis: number = 100;

    start(): void {
        tl.debug('jobQueue.start()');
        this.intervalId = setInterval(() => {
            try {
                var nextSearches = this.findNextJobSearches();
                for (var i in nextSearches) {
                    nextSearches[i].doWork();
                }

                var running = this.findRunningJobs();
                for (var i in running) {
                    running[i].doWork();
                }
                if (this.hasFailedJobs()) {
                    this.stop(false);
                } else if (this.getActiveJobs().length == 0) {
                    this.stop(true);
                } else {
                    this.flushJobConsolesSafely();
                }
            } catch (e) {
                tl.debug(e.message);
                tl.setResult(tl.TaskResult.Failed, e.message);
                this.stop(false);
            }
        }, this.intervalMillis);
    }

    stop(complete: boolean): void {
        tl.debug('jobQueue.stop()');
        clearInterval(this.intervalId);
        this.flushJobConsolesSafely();
        this.writeFinalMarkdown(complete);
    }

    hasFailedJobs(): boolean {
        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            if (job.state == JobState.Done) {
                if (job.getTaskResult() == tl.TaskResult.Failed) {
                    return true;
                }
            }
        }
        return false;
    }

    findRunningJobs(): Job[] {
        var running = [];
        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            if (job.state == JobState.Streaming || job.state == JobState.Downloading || job.state == JobState.Finishing) {
                running.push(job);
            }
        }
        return running;
    }

    findNextJobSearches(): JobSearch[] {
        var nextSearches: JobSearch[] = [];
        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            // the parent must be finished (or null for root) in order for a job to possibly be started
            if (job.state == JobState.Locating && (job.parent == null || job.parent.state == JobState.Done)) {
                // group these together so only search is done per job.identifier
                if (!nextSearches[job.identifier]) {
                    nextSearches[job.identifier] = this.searches[job.identifier];
                }
                nextSearches[job.identifier].searchFor(job);
            }
        }
        return nextSearches;
    }

    getActiveJobs(): Job[] {
        var active: Job[] = [];

        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            if (job.isActive()) {
                active.push(job);
            }
        }

        return active;
    }

    addJob(job: Job) {
        if (this.allJobs.length == 0) {
            this.rootJob = job;
        }
        this.allJobs.push(job);
        if (this.searches[job.identifier] == null) {
            this.searches[job.identifier] = new JobSearch(this, job.taskUrl, job.identifier);
        }
        job.search = this.searches[job.identifier];
    }

    flushJobConsolesSafely(): void {
        if (this.findActiveConsoleJob() == null) { //nothing is currently writing to the console
            var streamingJobs: Job[] = [];
            var addedToConsole: boolean = false;
            for (var i in this.allJobs) {
                var job = this.allJobs[i];
                if (job.state == JobState.Done) {
                    if (!job.isConsoleEnabled()) {
                        job.enableConsole(); // flush the finished ones
                        addedToConsole = true;
                    }
                } else if (job.state == JobState.Streaming || job.state == JobState.Finishing) {
                    streamingJobs.push(job); // these are the ones that could be running
                }
            }
            // finally, if there is only one remaining, it is safe to enable its console
            if (streamingJobs.length == 1) {
                streamingJobs[0].enableConsole();
            } else if (addedToConsole) {
                for (var i in streamingJobs) {
                    var job = streamingJobs[i];
                    console.log('Jenkins job pending: ' + job.executableUrl);
                }
            }
        }
    }

    /**
     * If there is a job currently writing to the console, find it.
     */
    findActiveConsoleJob(): Job {
        var activeJobs: Job[] = this.getActiveJobs();
        for (var i in activeJobs) {
            var job = activeJobs[i];
            if (job.isConsoleEnabled()) {
                return job;
            }
        }
        return null;
    }

    findJob(identifier: string, executableNumber: number): Job {
        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            if (job.identifier == identifier && job.executableNumber == executableNumber) {
                return job;
            }
        }
        return null;
    }

    writeFinalMarkdown(complete: boolean) {
        let colorize = (s) => {
            // 'Success' is green, everything else is red
            let color = 'red';
            if (s === tl.loc('succeeded')) {
                color = 'green';
            }

            return `<font color='${color}'>${s}</font>`
        }

        function walkHierarchy(job: Job, indent: string, padding: number): string {
            var jobContents = indent + '<ul style="padding-left:' + padding + '">\n';

            // if this job was joined to another follow that one instead
            job = findWorkingJob(job);

            if (job.executableNumber == -1) {
                jobContents += indent + job.name + ' ' + colorize(job.getResultString()) + '<br />\n';
            } else {
                jobContents += indent + '[' + job.name + ' #' + job.executableNumber + '](' + job.executableUrl + ') ' + colorize(job.getResultString()) + '<br />\n';
            }

            var childContents = "";
            for (var i in job.children) {
                var child = job.children[i];
                childContents += walkHierarchy(child, indent + tab, padding + paddingTab);
            }
            return jobContents + childContents + indent + '</ul>\n';
        }

        function findWorkingJob(job: Job) {
            if (job.state != JobState.Joined) {
                return job;
            } else {
                return findWorkingJob(job.joined);
            }
        }

        function createPipelineReport(job: Job, taskOptions: TaskOptions, report): string {
            let authority = util.getUrlAuthority(job.executableUrl);

            let getStageUrl = (authority, stage) => {
                let result = '';
                if (stage && stage['_links']
                          && stage['_links']['self']
                          && stage['_links']['self']['href'])
                {
                    result = stage['_links']['self']['href'];
                    //remove the api link
                    result = result.replace('/wfapi/describe', '');
                }

                return `${authority}${result}`;
            };


            let convertStatus = (s) => {
                let status = s.toLowerCase();
                if (status === 'success') {
                    status = tl.loc('succeeded');
                }

                return status;
            }

            // Top level pipeline job status
            let jobContent = '<ul style="padding-left: 0">';
            let jobName = taskOptions.jobName;
            if (taskOptions.isMultibranchPipelineJob) {
                jobName = `${jobName}/${taskOptions.multibranchPipelineBranch}`;
            }
            jobContent += '[' + jobName + ' #' + job.executableNumber + '](' + job.executableUrl + ') ' + colorize(job.getResultString());
            if (job.getResultString() !== tl.loc('succeeded')) {
                jobContent += ` ([${tl.loc('console')}](${job.executableUrl}/console))`
            }
            jobContent += '<br />';

            // For each stage, write its status
            let stageContents = '';
            for (let stage of report['stages']) {
                let stageUrl = getStageUrl(authority, stage);
                stageContents += '[' + stage["name"] + '](' + stageUrl + ') ' + colorize(convertStatus(stage.status))+'<br />';
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

        function generatePipelineReport(job: Job, taskOptions: TaskOptions, callback: (pipelineReport: string) => void) {
            util.getPipelineReport(job, taskOptions)
                .then((body) => {
                    if (body) {
                        let parsedBody = JSON.parse(body);
                        callback(createPipelineReport(job, taskOptions, parsedBody));
                    } else {
                        callback(tl.loc('FailedToGenerateSummary'));
                    }
                })
        }

        function generateMarkdownContent(job: Job, taskOptions: TaskOptions, callback: (markdownContent: string) => void) {
            util.isPipelineJob(job, taskOptions)
                .then((isPipeline) => {
                    if (isPipeline) {
                        generatePipelineReport(job, taskOptions, callback);
                    } else {
                        callback(walkHierarchy(job, "", 0));
                    }
                })
        }

        tl.debug('writing summary markdown');
        var thisQueue = this;
        var tempDir = shell.tempdir();
        var linkMarkdownFile = path.join(tempDir, 'JenkinsJob_' + this.rootJob.name + '_' + this.rootJob.executableNumber + '.md');
        tl.debug('markdown location: ' + linkMarkdownFile);
        var tab: string = "  ";
        var paddingTab: number = 4;
        generateMarkdownContent(this.rootJob, thisQueue.taskOptions, (markdownContents) => {
            fs.writeFile(linkMarkdownFile, markdownContents, function callback(err) {
                tl.debug('writeFinalMarkdown().writeFile().callback()');

                if (err) {
                    //don't fail the build -- there just won't be a link
                    console.log('Error creating link to Jenkins job: ' + err);
                } else {
                    console.log('##vso[task.addattachment type=Distributedtask.Core.Summary;name=Jenkins Results;]' + linkMarkdownFile);
                }

                var message: string = null;
                if (complete) {
                    if (thisQueue.taskOptions.capturePipeline) {
                        message = tl.loc('JenkinsPipelineComplete');
                    } else if (thisQueue.taskOptions.captureConsole) {
                        message = tl.loc('JenkinsJobCompletee');
                    } else {
                        message = tl.loc('JenkinsJobQueued');
                    }
                    tl.setResult(tl.TaskResult.Succeeded, message);
                } else {
                    if (thisQueue.taskOptions.capturePipeline) {
                        message = tl.loc('JenkinsPipelineFailed');
                    } else if (thisQueue.taskOptions.captureConsole) {
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