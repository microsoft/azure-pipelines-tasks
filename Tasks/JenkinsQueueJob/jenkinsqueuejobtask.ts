// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');

// node js modules

import job = require('./job');
import Job = job.Job;
import jobqueue = require('./jobqueue');
import JobQueue = jobqueue.JobQueue;
import util = require('./util');

export class TaskOptions {
    serverEndpoint: string;
    serverEndpointUrl: string;

    serverEndpointAuth: tl.EndpointAuthorization;
    username: string;
    password: string;

    jobName: string;

    captureConsole: boolean;
    // capturePipeline is only possible if captureConsole mode is enabled
    capturePipeline: boolean;

    pollIntervalMillis: number;

    parameterizedJob: boolean;
    // jobParameters are only possible if parameterizedJob is enabled
    jobParameters: string[];

    jobQueueUrl: string;
    teamJobQueueUrl: string;
    teamPluginUrl: string;

    teamBuildPluginAvailable: boolean;
    saveResultsTo: string;

    strictSSL: boolean;

    NO_CRUMB: string;
    crumb: string;

    constructor() {
        this.serverEndpoint = tl.getInput('serverEndpoint', true);
        this.serverEndpointUrl = tl.getEndpointUrl(this.serverEndpoint, false);
        tl.debug('serverEndpointUrl=' + this.serverEndpointUrl);
        this.serverEndpointAuth = tl.getEndpointAuthorization(this.serverEndpoint, false);
        this.username = this.serverEndpointAuth['parameters']['username'];
        this.password = this.serverEndpointAuth['parameters']['password'];

        this.jobName = tl.getInput('jobName', true);

        this.captureConsole = tl.getBoolInput('captureConsole', true);
        // capturePipeline is only possible if captureConsole mode is enabled
        this.capturePipeline = this.captureConsole ? tl.getBoolInput('capturePipeline', true) : false;

        this.pollIntervalMillis = 5000; // five seconds is what the Jenkins Web UI uses

        this.parameterizedJob = tl.getBoolInput('parameterizedJob', true);
        // jobParameters are only possible if parameterizedJob is enabled
        this.jobParameters = this.parameterizedJob ? tl.getDelimitedInput('jobParameters', '\n', false) : [];

        this.jobQueueUrl = util.addUrlSegment(this.serverEndpointUrl, util.convertJobName(this.jobName)) + ((this.parameterizedJob) ? '/buildWithParameters?delay=0sec' : '/build?delay=0sec');
        tl.debug('jobQueueUrl=' + this.jobQueueUrl);
        this.teamJobQueueUrl = util.addUrlSegment(this.serverEndpointUrl, '/team-build/build/' + this.jobName + '?delay=0sec');
        tl.debug('teamJobQueueUrl=' + this.teamJobQueueUrl);
        this.teamPluginUrl = util.addUrlSegment(this.serverEndpointUrl, '/pluginManager/available');
        tl.debug('teamPluginUrl=' + this.teamPluginUrl);

        this.teamBuildPluginAvailable = false;
        // 'Build.StagingDirectory' is available during build.
        // It is kept here (different than what is used during release) to maintain
        // compatibility with other tasks relying on Jenkins results being placed in this folder.
        var resultsDirectory: string = tl.getVariable('Build.StagingDirectory');
        if (!resultsDirectory) {
            // 'System.DefaultWorkingDirectory' is available during build and release
            resultsDirectory = tl.getVariable('System.DefaultWorkingDirectory');
        }
        this.saveResultsTo = path.join(resultsDirectory, 'jenkinsResults');

        this.strictSSL = ("true" !== tl.getEndpointDataParameter(this.serverEndpoint, "acceptUntrustedCerts", true));
        tl.debug('strictSSL=' + this.strictSSL);

        this.NO_CRUMB = 'NO_CRUMB';
        this.crumb = this.NO_CRUMB;
    }
}

async function doWork() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        
        var taskOptions: TaskOptions = new TaskOptions();

        var jobQueue: JobQueue = new JobQueue(taskOptions);
        var queueUri = await util.pollSubmitJob(taskOptions);
        console.log('Jenkins job queued');
        var rootJob = await util.pollCreateRootJob(queueUri, jobQueue, taskOptions);
        //start the job queue
        jobQueue.start();
    } catch (e) {
        tl.debug(e.message);
        tl._writeError(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();