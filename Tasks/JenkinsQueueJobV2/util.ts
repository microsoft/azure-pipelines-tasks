// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import stream = require('stream');
import tl = require('azure-pipelines-task-lib/task');
import os = require('os');
import Q = require('q');
import request = require('request');
import url = require('url');

import { Job } from './job';
import { JobQueue } from './jobqueue';
import { TaskOptions } from './jenkinsqueuejobtask';

export function getFullErrorMessage(httpResponse, message: string): string {
    const fullMessage: string = `${message}\nHttpResponse.statusCode=${httpResponse.statusCode}\nHttpResponse.statusMessage=${httpResponse.statusMessage}`;
    return fullMessage;
}

export function failReturnCode(httpResponse, message: string): void {
    const fullMessage = getFullErrorMessage(httpResponse, message);
    console.error(fullMessage);
    tl.setResult(tl.TaskResult.Failed, message);
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

/**
 * @class Represents error based on HttpResponse
 * @extends {Error} Error class
 */
export class HttpError extends Error {
    public body: string;
    public fullMessage: string;

    constructor(httpResponse: any, message: string) {
        super();
        this.fullMessage = getFullErrorMessage(httpResponse, message);
        this.message = message;
        this.body = httpResponse.body;
    }
}

export function convertJobName(jobName: string): string {
    return '/job/' + jobName.replace(/\//g, '/job/');
}

export function addUrlSegment(baseUrl: string, segment: string): string {
    let resultUrl: string;
    if (baseUrl.endsWith('/') && segment.startsWith('/')) {
        resultUrl = baseUrl + segment.slice(1);
    } else if (baseUrl.endsWith('/') || segment.startsWith('/')) {
        resultUrl = baseUrl + segment;
    } else {
        resultUrl = baseUrl + '/' + segment;
    }
    return resultUrl;
}

export function isPipelineJob(job: Job, taskOptions: TaskOptions): Q.Promise<boolean> {
    const deferred: Q.Deferred<boolean> = Q.defer<boolean>();
    const wfapiUrl: string = `${job.TaskUrl}/wfapi`;
    request.get({ url: wfapiUrl, strictSSL: taskOptions.strictSSL }, (err, response, body) => {
        if (response.statusCode === 200) {
            deferred.resolve(true);
        } else {
            deferred.resolve(false);
        }
    });

    return deferred.promise;
}

export function getPipelineReport(job: Job, taskOptions: TaskOptions): Q.Promise<any> {
    const deferred: Q.Deferred<any> = Q.defer<any>();
    const wfapiUrl: string = `${job.TaskUrl}/${job.ExecutableNumber}/wfapi/describe`;
    request.get({ url: wfapiUrl, strictSSL: taskOptions.strictSSL }, (err, response, body) => {
        if (response.statusCode === 200) {
            deferred.resolve(body);
        } else {
            deferred.reject(err);
        }
    });

    return deferred.promise;
}

export function getUrlAuthority(myUrl: string): string {
    const parsed: url.Url = url.parse(myUrl);

    let result: string = '';
    if (parsed.auth) {
        result += parsed.auth;
    } else {
        if (parsed.protocol && parsed.host) {
            result = `${parsed.protocol}//${parsed.host}`;
        }
    }

    return result;
}

export function pollCreateRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions): Q.Promise<Job> {
    const defer: Q.Deferred<Job> = Q.defer<Job>();

    const poll = async () => {
        await createRootJob(queueUri, jobQueue, taskOptions).then((job: Job) => {
            if (job != null) {
                defer.resolve(job);
            } else {
                // no job yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        }).fail((err: any) => {
            defer.reject(err);
        });
    };

    poll();

    return defer.promise;
}

function createRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions): Q.Promise<Job> {
    const defer: Q.Deferred<Job> = Q.defer<Job>();
    tl.debug('createRootJob(): ' + queueUri);

    request.get({ url: queueUri, strictSSL: taskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
        tl.debug('createRootJob().requestCallback()');
        if (err) {
            tl.debug(err);
            if (err.code == 'ECONNRESET') {
                defer.resolve(null);
            } else {
                const error = { message: tl.loc('JenkinsJobQueueUriInvalid', queueUri, JSON.stringify(err)) };
                defer.reject(error);
            }
        } else if (httpResponse.statusCode !== 200) {
            defer.reject(new HttpError(httpResponse, 'Job progress tracking failed to read job queue'));
        } else {
            const parsedBody: any = JSON.parse(body);
            tl.debug(`parsedBody for: ${queueUri} : ${JSON.stringify(parsedBody)}`);

            // canceled is spelled wrong in the body with 2 Ls (checking correct spelling also in case they fix it)
            if (parsedBody.cancelled || parsedBody.canceled) {
                defer.reject('Jenkins job canceled.');
            } else {
                const executable: any = parsedBody.executable;
                if (!executable) {
                    // job has not actually been queued yet
                    defer.resolve(null);
                } else {
                    const rootJob: Job = new Job(jobQueue, null, parsedBody.task.url, parsedBody.executable.url, parsedBody.executable.number, parsedBody.task.name);
                    defer.resolve(rootJob);
                }
            }
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}

export function pollSubmitJob(taskOptions: TaskOptions): Q.Promise<string> {
    const defer: Q.Deferred<string> = Q.defer<string>();

    const poll = async () => {
        await getCrumb(taskOptions).then(async (crumb: string) => {
            if (crumb != null) {
                await submitJob(taskOptions).then((queueUri: string) => {
                    if (queueUri != null) {
                        defer.resolve(queueUri);
                    } else {
                        // no queueUri yet, but no failure either, so keep trying
                        setTimeout(poll, taskOptions.pollIntervalMillis);
                    }
                }).fail((err: any) => {
                    defer.reject(err);
                });
            } else {
                // no crumb yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        }).fail((err: any) => {
            defer.reject(err);
        });
    };

    poll();

    return defer.promise;
}

function submitJob(taskOptions: TaskOptions): Q.Promise<string> {
    const defer: Q.Deferred<string> = Q.defer<string>();
    tl.debug('submitJob(): ' + JSON.stringify(taskOptions));

    function addCrumb(json: any): any {
        if (taskOptions.crumb && taskOptions.crumb != taskOptions.NO_CRUMB) {
            json.headers = {};
            const splitIndex: number = taskOptions.crumb.indexOf(':');
            const crumbName: string = taskOptions.crumb.substr(0, splitIndex);
            const crumbValue: string = taskOptions.crumb.slice(splitIndex + 1);
            json.headers[crumbName] = crumbValue;
        }
        return json;
    }

    const teamBuildPostData: any = addCrumb(
        {
            url: taskOptions.teamJobQueueUrl,
            form: {
                json: JSON.stringify({
                    'team-build': getTeamParameters(taskOptions),
                    'parameter': parseJobParametersTeamBuild(taskOptions.jobParameters)
                })
            },
            strictSSL: taskOptions.strictSSL
        }
    );

    tl.debug('teamBuildPostData = ' + JSON.stringify(teamBuildPostData));
    // first try team-build plugin endpoint, if that fails, then try the default endpoint
    request.post(teamBuildPostData, function teamBuildRequestCallback(err, httpResponse, body) {
        tl.debug('submitJob().teamBuildRequestCallback(teamBuildPostData)');
        if (err) {
            if (err.code == 'ECONNRESET') {
                tl.debug(err);
                defer.resolve(null);
            } else {
                defer.reject(err);
            }
        } else if (httpResponse.statusCode === 404) { // team-build plugin endpoint failed because it is not installed
            console.log('Install the "Team Foundation Server Plug-in" for improved Jenkins integration\n' + taskOptions.teamPluginUrl);
            taskOptions.teamBuildPluginAvailable = false;

            tl.debug('httpResponse: ' + JSON.stringify(httpResponse));
            const jobQueuePostData: any = addCrumb(taskOptions.parameterizedJob ?
                {
                    url: taskOptions.jobQueueUrl,
                    formData: parseJobParameters(taskOptions.jobParameters),
                    strictSSL: taskOptions.strictSSL
                } :
                {
                    url: taskOptions.jobQueueUrl,
                    strictSSL: taskOptions.strictSSL
                }
            );
            tl.debug('jobQueuePostData = ' + JSON.stringify(jobQueuePostData));

            request.post(jobQueuePostData, function jobQueueRequestCallback(err, httpResponse, body) {
                tl.debug('submitJob().jobQueueRequestCallback(jobQueuePostData)');
                if (err) {
                    if (err.code == 'ECONNRESET') {
                        tl.debug(err);
                        defer.resolve(null);
                    } else {
                        defer.reject(err);
                    }
                } else if (httpResponse.statusCode !== 201) {
                    defer.reject(new HttpError(httpResponse, 'Job creation failed.'));
                } else {
                    const queueUri: string = addUrlSegment(httpResponse.headers.location, 'api/json');
                    defer.resolve(queueUri);
                }
            }).auth(taskOptions.username, taskOptions.password, true);
        } else if (httpResponse.statusCode !== 201) {
            defer.reject(new HttpError(httpResponse, 'Job creation failed.'));
        } else {
            taskOptions.teamBuildPluginAvailable = true;
            const jsonBody: any = JSON.parse(body);
            const queueUri: string = addUrlSegment(jsonBody.created, 'api/json');
            defer.resolve(queueUri);
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}

function getCrumb(taskOptions: TaskOptions): Q.Promise<string> {
    const defer: Q.Deferred<string> = Q.defer<string>();
    const crumbRequestUrl: string = addUrlSegment(taskOptions.serverEndpointUrl, '/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)');
    tl.debug('crumbRequestUrl: ' + crumbRequestUrl);

    request.get({ url: crumbRequestUrl, strictSSL: taskOptions.strictSSL }, function (err, httpResponse, body) {
        if (err) {
            if (err.code == 'ECONNRESET') {
                tl.debug(err);
                defer.resolve(null);
            } else {
                defer.reject(err);
            }
        } else if (httpResponse.statusCode === 404) {
            tl.debug('crumb endpoint not found');
            taskOptions.crumb = taskOptions.NO_CRUMB;
            defer.resolve(taskOptions.NO_CRUMB);
        } else if (httpResponse.statusCode !== 200) {
            defer.reject(new HttpError(httpResponse, 'Crumb request failed.'));
        } else {
            taskOptions.crumb = body;
            tl.debug('crumb: ' + taskOptions.crumb);
            defer.resolve(taskOptions.crumb);
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}

export class StringWritable extends stream.Writable {
    private value: string = '';

    constructor(options) {
        super(options);
    }

    _write(data: any, encoding: string, callback: Function): void {
        tl.debug(data);
        this.value += data;
        if (callback) {
            callback();
        }
    }

    toString(): string {
        return this.value;
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
function parseJobParameters(jobParameters: string[]): any {
    let formData: any = {};
    for (let i: number = 0; i < jobParameters.length; i++) {
        const paramLine: string = jobParameters[i].trim();
        const splitIndex: number = paramLine.indexOf('=');
        if (splitIndex <= 0) { // either no paramValue (-1), or no paramName (0)
            throw 'Job parameters should be specified as "parameterName=parameterValue" with one name, value pair per line. Invalid parameter line: ' + jobParameters[i];
        }
        const paramName: string = paramLine.substr(0, splitIndex).trim();
        const paramValue: string = paramLine.slice(splitIndex + 1).trim();
        formData[paramName] = paramValue;
    }
    return formData;
}

function parseJobParametersTeamBuild(jobParameters: string[]): any {
    const formData: any = parseJobParameters(jobParameters);
    const jsonArray: any[] = [];

    for (const paramName in formData) {
        let json = {};
        json['name'] = paramName;
        json['value'] = formData[paramName];
        jsonArray.push(json);
    }
    return jsonArray;
}

function getTeamParameters(taskOptions: TaskOptions): any {
    const formData: any = {};
    allTeamBuildVariables.forEach((variableName) => {
        const paramValue: string = tl.getVariable(variableName);
        if (paramValue) {
            formData[variableName] = paramValue;
        }
    });

    // add task specific options
    if (taskOptions.isMultibranchPipelineJob) {
        formData['QueueJobTask.MultibranchPipelineBranch'] = taskOptions.multibranchPipelineBranch;
    }

    return formData;
}

//https://www.visualstudio.com/docs/build/define/variables
const allTeamBuildVariables: string[] = [
    //control variables
    'Build.Clean',
    'Build.SyncSources',
    'System.Debug',
    //predefined variables
    'Agent.BuildDirectory',
    'Agent.HomeDirectory',
    'Agent.Id',
    'Agent.MachineName',
    'Agent.Name',
    'Agent.WorkFolder',
    'Build.ArtifactStagingDirectory',
    'Build.BuildId',
    'Build.BuildNumber',
    'Build.BuildUri',
    'Build.BinariesDirectory',
    'Build.DefinitionName',
    'Build.DefinitionVersion',
    'Build.QueuedBy',
    'Build.QueuedById',
    'Build.Repository.Clean',
    'Build.Repository.LocalPath',
    'Build.Repository.Name',
    'Build.Repository.Provider',
    'Build.Repository.Tfvc.Workspace',
    'Build.Repository.Uri',
    'Build.RequestedFor',
    'Build.RequestedForId',
    'Build.SourceBranch',
    'Build.SourceBranchName',
    'Build.SourcesDirectory',
    'Build.SourceVersion',
    'Build.StagingDirectory',
    'Build.Repository.Git.SubmoduleCheckout',
    'Build.SourceTfvcShelveset',
    'Common.TestResultsDirectory',
    //'System.AccessToken', -- holding this one back, Jenkins has it's own access mechamisms to TFS
    'System.CollectionId',
    'System.DefaultWorkingDirectory',
    'System.DefinitionId',
    'System.TeamFoundationCollectionUri',
    'System.TeamProject',
    'System.TeamProjectId',
    'TF_BUILD'
];
