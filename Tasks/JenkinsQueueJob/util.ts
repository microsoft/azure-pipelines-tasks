/// <reference path="../../definitions/node.d.ts"/>
import tl = require('vsts-task-lib/task');
import Q = require('q');

var request = require('request');

import task = require('./jenkinsqueuejobtask');
import TaskOptions = task.TaskOptions;

import job = require('./job');
import Job = job.Job;

import jobqueue = require('./jobqueue');
import JobQueue = jobqueue.JobQueue;

export function getFullErrorMessage(httpResponse, message: string): String {
    var fullMessage = message +
        '\nHttpResponse.statusCode=' + httpResponse.statusCode +
        '\nHttpResponse.statusMessage=' + httpResponse.statusMessage +
        '\nHttpResponse=\n' + JSON.stringify(httpResponse);
    return fullMessage;
}

export function failReturnCode(httpResponse, message: string): void {
    var fullMessage = message +
        '\nHttpResponse.statusCode=' + httpResponse.statusCode +
        '\nHttpResponse.statusMessage=' + httpResponse.statusMessage +
        '\nHttpResponse=\n' + JSON.stringify(httpResponse);
    fail(fullMessage);
}

export function handleConnectionResetError(err): void {
    if (err.code == 'ECONNRESET') {
        tl.debug(err);
    } else {
        fail(err);
    }
}

export function fail(message: string): void {
    throw new FailTaskError(message);
}

export class FailTaskError extends Error {
}

export function addUrlSegment(baseUrl: string, segment: string): string {
    var resultUrl = null;
    if (baseUrl.endsWith('/') && segment.startsWith('/')) {
        resultUrl = baseUrl + segment.slice(1);
    } else if (baseUrl.endsWith('/') || segment.startsWith('/')) {
        resultUrl = baseUrl + segment;
    } else {
        resultUrl = baseUrl + '/' + segment;
    }
    return resultUrl;
}

export function pollCreateRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions): Q.Promise<Job> {
    var defer: Q.Deferred<Job> = Q.defer<Job>();

    var poll = async () => {
        await createRootJob(queueUri, jobQueue, taskOptions).then((job: Job) => {
            if (job != null) {
                defer.resolve(job);
            } else {
                // no job yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        }).fail((err: any) => {
            defer.reject(err);
        })
    };

    poll();

    return defer.promise;
}

function createRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions): Q.Promise<Job> {
    var defer: Q.Deferred<Job> = Q.defer<Job>();
    tl.debug('createRootJob(): ' + queueUri);

    request.get({ url: queueUri }, function requestCallback(err, httpResponse, body) {
        tl.debug('createRootJob().requestCallback()');
        if (err) {
            if (err.code == 'ECONNRESET') {
                tl.debug(err);
                defer.resolve(null);
            } else {
                defer.reject(err);
            }
        } else if (httpResponse.statusCode != 200) {
            defer.reject(getFullErrorMessage(httpResponse, 'Job progress tracking failed to read job queue'));
        } else {
            var parsedBody = JSON.parse(body);
            tl.debug("parsedBody for: " + queueUri + ": " + JSON.stringify(parsedBody));

            // canceled is spelled wrong in the body with 2 Ls (checking correct spelling also in case they fix it)
            if (parsedBody.cancelled || parsedBody.canceled) {
                defer.reject('Jenkins job canceled.');
            } else {
                var executable = parsedBody.executable;
                if (!executable) {
                    // job has not actually been queued yet
                    defer.resolve(null);
                } else {
                    var rootJob: Job = new job.Job(jobQueue, null, parsedBody.task.url, parsedBody.executable.url, parsedBody.executable.number, parsedBody.task.name);
                    defer.resolve(rootJob);
                }
            }
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}

export function pollSubmitJob(initialPostData: any, taskOptions: TaskOptions): Q.Promise<string> {
    var defer: Q.Deferred<string> = Q.defer<string>();

    var poll = async () => {
        await submitJob(initialPostData, taskOptions).then((queueUri: string) => {
            if (queueUri != null) {
                defer.resolve(queueUri);
            } else {
                // no queueUri yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        }).fail((err: any) => {
            defer.reject(err);
        })
    };

    poll();

    return defer.promise;
}

function submitJob(initialPostData: any, taskOptions: TaskOptions): Q.Promise<string> {
    var defer: Q.Deferred<string> = Q.defer<string>();
    tl.debug('submitJob(): ' + JSON.stringify(initialPostData));

    request.post(initialPostData, function requestCallback(err, httpResponse, body) {
        tl.debug('submitJob().requestCallback()');
        if (err) {
            if (err.code == 'ECONNRESET') {
                tl.debug(err);
                defer.resolve(null);
            } else {
                defer.reject(err);
            }
        } else if (httpResponse.statusCode != 201) {
            defer.reject(getFullErrorMessage(httpResponse, 'Job creation failed.'));
        } else {
            var queueUri = addUrlSegment(httpResponse.headers.location, 'api/json');
            defer.resolve(queueUri);
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}