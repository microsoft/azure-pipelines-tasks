/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/shelljs.d.ts"/>

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
                if (this.getActiveJobs().length == 0) {
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
        var message: string = null;
        if (complete) {
            if (this.taskOptions.capturePipeline) {
                message = 'Jenkins pipeline complete';
            } else if (this.taskOptions.captureConsole) {
                message = 'Jenkins job complete';
            } else {
                message = 'Jenkins job queued';
            }
            tl.setResult(tl.TaskResult.Succeeded, message);
        } else {
            if (this.taskOptions.capturePipeline) {
                message = 'Jenkins pipeline failed';
            } else if (this.taskOptions.captureConsole) {
                message = 'Jenkins job failed';
            } else {
                message = 'Jenkins job failed to queue';
            }
        }
        this.writeFinalMarkdown();
    }

    findRunningJobs(): Job[] {
        var running = [];
        for (var i in this.allJobs) {
            var job = this.allJobs[i];
            if (job.state == JobState.Streaming || job.state == JobState.Finishing) {
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

    writeFinalMarkdown() {
        tl.debug('writing summary markdown');
        var tempDir = shell.tempdir();
        var linkMarkdownFile = path.join(tempDir, 'JenkinsJob_' + this.rootJob.name + '_' + this.rootJob.executableNumber + '.md');
        tl.debug('markdown location: ' + linkMarkdownFile);
        var tab: string = "  ";
        var paddingTab: number = 4;
        var markdownContents = walkHierarchy(this.rootJob, "", 0);

        function walkHierarchy(job: Job, indent: string, padding: number): string {
            var jobContents = indent + '<ul style="padding-left:' + padding + '">\n';

            // if this job was joined to another follow that one instead
            job = findWorkingJob(job);
            var jobState: JobState = job.state;

            jobContents += indent + '[' + job.name + ' #' + job.executableNumber + '](' + job.executableUrl + ') ' + job.getResultString() + '<br>\n';

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

        fs.writeFile(linkMarkdownFile, markdownContents, function callback(err) {
            tl.debug('writeFinalMarkdown().writeFile().callback()');

            if (err) {
                //don't fail the build -- there just won't be a link
                console.log('Error creating link to Jenkins job: ' + err);
            } else {
                console.log('##vso[task.addattachment type=Distributedtask.Core.Summary;name=Jenkins Results;]' + linkMarkdownFile);
            }
        });
    }
}