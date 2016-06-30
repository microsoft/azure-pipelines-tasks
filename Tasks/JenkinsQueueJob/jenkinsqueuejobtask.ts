// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/shelljs.d.ts"/>

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
    serverEndpoint: string = tl.getInput('serverEndpoint', true);
    serverEndpointUrl: string = tl.getEndpointUrl(this.serverEndpoint, false);

    serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(this.serverEndpoint, false);
    username: string = this.serverEndpointAuth['parameters']['username'];
    password: string = this.serverEndpointAuth['parameters']['password'];

    jobName: string = tl.getInput('jobName', true);

    captureConsole: boolean = tl.getBoolInput('captureConsole', true);
    // capturePipeline is only possible if captureConsole mode is enabled
    capturePipeline: boolean = this.captureConsole ? tl.getBoolInput('capturePipeline', true) : false;

    pollIntervalMillis: number = 5000; // five seconds is what the Jenkins Web UI uses

    parameterizedJob: boolean = tl.getBoolInput('parameterizedJob', true);
    // jobParameters are only possible if parameterizedJob is enabled
    jobParameters: string[] = this.parameterizedJob ? tl.getDelimitedInput('jobParameters', '\n', false) : [];

    jobQueueUrl: string = util.addUrlSegment(this.serverEndpointUrl, '/job/' + this.jobName) + ((this.parameterizedJob) ? '/buildWithParameters?delay=0sec' : '/build?delay=0sec');

    constructor() {
        tl.debug('serverEndpointUrl=' + this.serverEndpointUrl);
        tl.debug('jobQueueUrl=' + this.jobQueueUrl);
    }
}

/**
 * Supported parameter types: boolean, string, choice, password
 * 
 * - If a parameter is not defined by Jenkins it is fine to pass it anyway
 * - Anything passed to a boolean parameter other than 'true' (case insenstive) becomes false.
 * - Invalid choice parameters result in a 500 response.
 * 
 */
function parseJobParameters(jobParameters: string[]) {
    var formData = {};
    for (var i = 0; i < jobParameters.length; i++) {
        var paramLine = jobParameters[i].trim();
        var splitIndex = paramLine.indexOf('=');
        if (splitIndex <= 0) { // either no paramValue (-1), or no paramName (0)
            throw 'Job parameters should be specified as "parameterName=parameterValue" with one name, value pair per line. Invalid parameter line: ' + jobParameters[i];
        }
        var paramName = paramLine.substr(0, splitIndex).trim();
        var paramValue = paramLine.slice(splitIndex + 1).trim();
        formData[paramName] = paramValue;
    }
    return formData;
}

async function doWork() {
    try {
        var taskOptions: TaskOptions = new TaskOptions();

        var jobQueue: JobQueue = new JobQueue(taskOptions);
        var initialPostData = taskOptions.parameterizedJob ?
            { url: taskOptions.jobQueueUrl, formData: parseJobParameters(taskOptions.jobParameters) } :
            { url: taskOptions.jobQueueUrl };

        tl.debug('initialPostData = ' + JSON.stringify(initialPostData));
        var queueUri = await util.pollSubmitJob(initialPostData, taskOptions);
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