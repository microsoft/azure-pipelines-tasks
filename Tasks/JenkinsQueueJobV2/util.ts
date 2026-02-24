// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import stream = require('stream');
import tl = require('azure-pipelines-task-lib/task');
import os = require('os');
import Q = require('q');
import * as httpm from 'typed-rest-client/HttpClient';
import * as httpi from 'typed-rest-client/Interfaces';
import * as httpHandlers from 'typed-rest-client/Handlers';

import { Job } from './job';
import { JobQueue } from './jobqueue';
import { TaskOptions } from './jenkinsqueuejobtask';

/**
 * Creates an HTTP client with proper authentication and SSL settings for Jenkins API calls.
 * @param taskOptions The task options containing credentials and SSL settings
 * @returns Configured HttpClient instance
 */
export function createHttpClient(taskOptions: TaskOptions): httpm.HttpClient {
    const handlers: httpHandlers.BasicCredentialHandler[] = [];
    
    if (taskOptions.username && taskOptions.password) {
        handlers.push(new httpHandlers.BasicCredentialHandler(
            taskOptions.username,
            taskOptions.password
        ));
    }

    const requestOptions: httpi.IRequestOptions = {
        ignoreSslError: !taskOptions.strictSSL
    };

    return new httpm.HttpClient('JenkinsQueueJob', handlers, requestOptions);
}

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

export function isPipelineJob(job: Job, taskOptions: TaskOptions, httpClient: httpm.HttpClient): Q.Promise<boolean> {
    const deferred: Q.Deferred<boolean> = Q.defer<boolean>();
    const wfapiUrl: string = `${job.TaskUrl}/wfapi`;
    
    httpClient.get(wfapiUrl).then((response) => {
        if (response.message.statusCode === 200) {
            deferred.resolve(true);
        } else {
            deferred.resolve(false);
        }
    }).catch((err) => {
        deferred.resolve(false);
    });

    return deferred.promise;
}

export async function getPipelineReport(job: Job, taskOptions: TaskOptions, httpClient: httpm.HttpClient): Promise<any> {
    const wfapiUrl: string = `${job.TaskUrl}/${job.ExecutableNumber}/wfapi/describe`;
    
    try {
        const response = await httpClient.get(wfapiUrl);
        if (response.message.statusCode === 200) {
            const body = await response.readBody();
            return body;
        } else {
            throw new HttpError(
                { statusCode: response.message.statusCode, statusMessage: response.message.statusMessage },
                'Failed to get pipeline report'
            );
        }
    } catch (err) {
        throw err;
    }
}

export function getUrlAuthority(myUrl: string): string {
    try {
        const parsed = new URL(myUrl);

        let result: string = '';
        if (parsed.username) {
            result += parsed.username + (parsed.password ? ':' + parsed.password : '');
        } else {
            if (parsed.protocol && parsed.host) {
                result = `${parsed.protocol}//${parsed.host}`;
            }
        }

        return result;
    } catch (err) {
        tl.debug(`Invalid URL: ${myUrl}, error: ${err.message}`);
        return '';
    }
}

export function pollCreateRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions, httpClient: httpm.HttpClient): Q.Promise<Job> {
    const defer: Q.Deferred<Job> = Q.defer<Job>();

    const poll = async () => {
        try {
            const job = await createRootJob(queueUri, jobQueue, taskOptions, httpClient);
            if (job != null) {
                defer.resolve(job);
            } else {
                // no job yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        } catch (err) {
            defer.reject(err);
        }
    };

    poll();

    return defer.promise;
}

async function createRootJob(queueUri: string, jobQueue: JobQueue, taskOptions: TaskOptions, httpClient: httpm.HttpClient): Promise<Job> {
    tl.debug('createRootJob(): ' + queueUri);

    try {
        const response = await httpClient.get(queueUri);
        tl.debug('createRootJob() statusCode: ' + response.message.statusCode);
        const statusCode = response.message.statusCode;
        
        if (statusCode !== 200) {
            throw new HttpError({ statusCode, statusMessage: response.message.statusMessage }, 'Job progress tracking failed to read job queue');
        } else {
            const body = await response.readBody();
            const parsedBody: any = JSON.parse(body);
            tl.debug(`parsedBody for: ${queueUri} : ${JSON.stringify(parsedBody)}`);

            // canceled is spelled wrong in the body with 2 Ls (checking correct spelling also in case they fix it)
            if (parsedBody.cancelled || parsedBody.canceled) {
                throw new Error('Jenkins job canceled.');
            } else {
                const executable: any = parsedBody.executable;
                if (!executable) {
                    // job has not actually been queued yet
                    return null;
                } else {
                    const rootJob: Job = new Job(jobQueue, null, parsedBody.task.url, parsedBody.executable.url, parsedBody.executable.number, parsedBody.task.name);
                    return rootJob;
                }
            }
        }
    } catch (err) {
        tl.debug(err);
        if (err.code == 'ECONNRESET') {
            return null;
        } else if (err instanceof HttpError) {
            throw err;
        } else {
            throw new Error(tl.loc('JenkinsJobQueueUriInvalid', queueUri, JSON.stringify(err)));
        }
    }
}

export function pollSubmitJob(taskOptions: TaskOptions, httpClient: httpm.HttpClient): Q.Promise<string> {
    const defer: Q.Deferred<string> = Q.defer<string>();

    const poll = async () => {
        try {
            const crumb = await getCrumb(taskOptions, httpClient);
            if (crumb != null) {
                try {
                    const queueUri = await submitJob(taskOptions, httpClient);
                    if (queueUri != null) {
                        defer.resolve(queueUri);
                    } else {
                        // no queueUri yet, but no failure either, so keep trying
                        setTimeout(poll, taskOptions.pollIntervalMillis);
                    }
                } catch (err) {
                    defer.reject(err);
                }
            } else {
                // no crumb yet, but no failure either, so keep trying
                setTimeout(poll, taskOptions.pollIntervalMillis);
            }
        } catch (err) {
            defer.reject(err);
        }
    };

    poll();

    return defer.promise;
}

async function submitJob(taskOptions: TaskOptions, httpClient: httpm.HttpClient): Promise<string> {
    tl.debug('submitJob(): ' + JSON.stringify(taskOptions));

    function addCrumb(): httpi.IHeaders {
        const headers: httpi.IHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (taskOptions.crumb && taskOptions.crumb != taskOptions.NO_CRUMB) {
            const splitIndex: number = taskOptions.crumb.indexOf(':');
            const crumbName: string = taskOptions.crumb.substr(0, splitIndex);
            const crumbValue: string = taskOptions.crumb.slice(splitIndex + 1);
            headers[crumbName] = crumbValue;
        }
        return headers;
    }

    const teamBuildPostData = `json=${encodeURIComponent(JSON.stringify({
        'team-build': getTeamParameters(taskOptions),
        'parameter': parseJobParametersTeamBuild(taskOptions.jobParameters)
    }))}`;

    tl.debug('teamBuildPostData = ' + teamBuildPostData);
    
    // first try team-build plugin endpoint, if that fails, then try the default endpoint
    try {
        const response = await httpClient.post(taskOptions.teamJobQueueUrl, teamBuildPostData, addCrumb());
        const statusCode = response.message.statusCode;
        tl.debug('submitJob() team-build statusCode: ' + statusCode);
        
        if (statusCode === 404) { // team-build plugin endpoint failed because it is not installed
            console.log('Install the "Team Foundation Server Plug-in" for improved Jenkins integration\n' + taskOptions.teamPluginUrl);
            taskOptions.teamBuildPluginAvailable = false;

            // Try the default endpoint
            let jobQueuePostData = '';
            if (taskOptions.parameterizedJob) {
                const formData = parseJobParameters(taskOptions.jobParameters);
                jobQueuePostData = Object.keys(formData).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(formData[key])}`).join('&');
            }

            tl.debug('jobQueuePostData = ' + jobQueuePostData);
            try {
                const response2 = await httpClient.post(taskOptions.jobQueueUrl, jobQueuePostData, addCrumb());
                const statusCode2 = response2.message.statusCode;
                tl.debug('submitJob() job queue statusCode: ' + statusCode2);
                
                if (statusCode2 !== 201) {
                    throw new HttpError({ statusCode: statusCode2, statusMessage: response2.message.statusMessage }, 'Job creation failed.');
                } else {
                    const location = response2.message.headers['location'] as string;
                    const queueUri: string = addUrlSegment(location, 'api/json');
                    return queueUri;
                }
            } catch (err) {
                if (err.code == 'ECONNRESET') {
                    tl.debug(err);
                    return null;
                } else {
                    throw err;
                }
            }
        } else if (statusCode !== 201) {
            throw new HttpError({ statusCode, statusMessage: response.message.statusMessage }, 'Job creation failed.');
        } else {
            taskOptions.teamBuildPluginAvailable = true;
            const body = await response.readBody();
            const jsonBody: any = JSON.parse(body);
            const queueUri: string = addUrlSegment(jsonBody.created, 'api/json');
            return queueUri;
        }
    } catch (err) {
        if (err.code == 'ECONNRESET') {
            tl.debug(err);
            return null;
        } else {
            throw err;
        }
    }
}

async function getCrumb(taskOptions: TaskOptions, httpClient: httpm.HttpClient): Promise<string> {
    const crumbRequestUrl: string = addUrlSegment(taskOptions.serverEndpointUrl, '/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)');
    tl.debug('crumbRequestUrl: ' + crumbRequestUrl);

    try {
        const response = await httpClient.get(crumbRequestUrl);
        const statusCode = response.message.statusCode;
        
        if (statusCode === 404) {
            tl.debug('crumb endpoint not found');
            taskOptions.crumb = taskOptions.NO_CRUMB;
            return taskOptions.NO_CRUMB;
        } else if (statusCode !== 200) {
            throw new HttpError({ statusCode, statusMessage: response.message.statusMessage }, 'Crumb request failed.');
        } else {
            const body = await response.readBody();
            taskOptions.crumb = body;
            tl.debug('crumb: ' + taskOptions.crumb);
            return taskOptions.crumb;
        }
    } catch (err) {
        if (err.code == 'ECONNRESET') {
            tl.debug(err);
            return null;
        } else {
            throw err;
        }
    }
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
