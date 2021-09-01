// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');
import os = require('os');
import util = require('./util');

import { Job } from './job';
import { JobQueue } from './jobqueue';

export class TaskOptions {
    serverEndpoint: string;
    serverEndpointUrl: string;

    serverEndpointAuth: tl.EndpointAuthorization;
    username: string;
    password: string;

    jobName: string;
    isMultibranchPipelineJob: boolean;
    multibranchPipelineBranch: string;

    captureConsole: boolean;
    // capturePipeline is only possible if captureConsole mode is enabled
    capturePipeline: boolean;

    pollIntervalMillis: number;

    //initialize retry count and timer
    retryCount: number;
    delayBetweenRetries: number;

    parameterizedJob: boolean;
    // jobParameters are only possible if parameterizedJob is enabled
    jobParameters: string[];

    failOnUnstableResult: boolean;

    jobQueueUrl: string;
    teamJobQueueUrl: string;
    teamPluginUrl: string;

    teamBuildPluginAvailable: boolean;
    saveResultsTo: string;

    strictSSL: boolean;

    NO_CRUMB: string;
    crumb: string;

    shouldFail: boolean;
    failureMsg: string;

    constructor() {
        this.serverEndpoint = tl.getInput('serverEndpoint', true);
        this.serverEndpointUrl = tl.getEndpointUrl(this.serverEndpoint, false);
        tl.debug('serverEndpointUrl=' + this.serverEndpointUrl);
        this.serverEndpointAuth = tl.getEndpointAuthorization(this.serverEndpoint, false);
        this.username = this.serverEndpointAuth['parameters']['username'];
        this.password = this.serverEndpointAuth['parameters']['password'];

        this.jobName = tl.getInput('jobName', true);
        this.isMultibranchPipelineJob = tl.getBoolInput('isMultibranchJob', false);
        if (this.isMultibranchPipelineJob) {
            this.multibranchPipelineBranch = tl.getInput('multibranchPipelineBranch', true);
        }

        this.captureConsole = tl.getBoolInput('captureConsole', true);
        // capturePipeline is only possible if captureConsole mode is enabled
        this.capturePipeline = this.captureConsole ? tl.getBoolInput('capturePipeline', true) : false;

        this.pollIntervalMillis = 5000; // five seconds is what the Jenkins Web UI uses

        this.retryCount = parseInt(tl.getInput('retryCount', false));
        this.delayBetweenRetries = parseInt(tl.getInput('delayBetweenRetries', false));

        this.parameterizedJob = tl.getBoolInput('parameterizedJob', true);
        // jobParameters are only possible if parameterizedJob is enabled
        this.jobParameters = this.parameterizedJob ? tl.getDelimitedInput('jobParameters', '\n', false) : [];
        this.failOnUnstableResult = tl.getBoolInput('failOnUnstableResult', false);

        this.jobQueueUrl = util.addUrlSegment(this.serverEndpointUrl, util.convertJobName(this.jobName)) + ((this.parameterizedJob) ? '/buildWithParameters?delay=0sec' : '/build?delay=0sec');
        tl.debug('jobQueueUrl=' + this.jobQueueUrl);
        this.teamJobQueueUrl = util.addUrlSegment(this.serverEndpointUrl, '/team-build/' + ((this.parameterizedJob) ? 'buildWithParameters/' : 'build/') + this.jobName + '?delay=0sec');
        tl.debug('teamJobQueueUrl=' + this.teamJobQueueUrl);
        this.teamPluginUrl = util.addUrlSegment(this.serverEndpointUrl, '/pluginManager/available');
        tl.debug('teamPluginUrl=' + this.teamPluginUrl);

        this.teamBuildPluginAvailable = false;
        // 'Build.StagingDirectory' is available during build.
        // It is kept here (different than what is used during release) to maintain
        // compatibility with other tasks relying on Jenkins results being placed in this folder.
        let resultsDirectory: string = tl.getVariable('Build.StagingDirectory');
        if (!resultsDirectory) {
            // 'System.DefaultWorkingDirectory' is available during build and release
            resultsDirectory = tl.getVariable('System.DefaultWorkingDirectory');
        }
        this.saveResultsTo = path.join(resultsDirectory, 'jenkinsResults');

        this.strictSSL = ('true' !== tl.getEndpointDataParameter(this.serverEndpoint, 'acceptUntrustedCerts', true));
        tl.debug('strictSSL=' + this.strictSSL);

        this.NO_CRUMB = 'NO_CRUMB';
        this.crumb = this.NO_CRUMB;

        this.shouldFail = false;
        this.failureMsg = '';
    }
}

async function doWork() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        const taskOptions: TaskOptions = new TaskOptions();
        const jobQueue: JobQueue = new JobQueue(taskOptions);
        const queueUri = await util.pollSubmitJob(taskOptions);
        console.log(tl.loc('JenkinsJobQueued'));
        const rootJob = await util.pollCreateRootJob(queueUri, jobQueue, taskOptions);
        //start the job queue
        jobQueue.Start();
        //store the job name in the output variable
        tl.setVariable('JENKINS_JOB_ID', rootJob.ExecutableNumber.toString());
    } catch (e) {
        let message: string;
        if (e instanceof util.HttpError) {
            message = e.message;
            console.error(e.fullMessage);
            console.error(e.body);
        } else if (e instanceof Error) {
            message = e.message;
            console.error(e);
        } else {
            message = e;
            console.error(e);
        }
        tl.setResult(tl.TaskResult.Failed, message);
    }
}

doWork();
