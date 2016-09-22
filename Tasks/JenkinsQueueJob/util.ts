
import stream = require('stream');

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

export function convertJobName(jobName: string): string {
    return '/job/' + jobName.replace('/', '/job/');
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

    request.get({ url: queueUri, strictSSL: taskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
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

export function pollSubmitJob(taskOptions: TaskOptions): Q.Promise<string> {
    var defer: Q.Deferred<string> = Q.defer<string>();

    var poll = async () => {
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
    var defer: Q.Deferred<string> = Q.defer<string>();
    tl.debug('submitJob(): ' + JSON.stringify(taskOptions));

    function addCrumb(json: any): any {
        if (taskOptions.crumb && taskOptions.crumb != taskOptions.NO_CRUMB) {
            json.headers = {};
            let splitIndex: number = taskOptions.crumb.indexOf(':');
            let crumbName = taskOptions.crumb.substr(0, splitIndex);
            let crumbValue = taskOptions.crumb.slice(splitIndex + 1);
            json.headers[crumbName] = crumbValue;
        }
        return json;
    }

    let teamBuildPostData = addCrumb(
        {
            url: taskOptions.teamJobQueueUrl,
            form: {
                json: JSON.stringify({
                    "team-build": getTeamParameters(),
                    "parameter": parseJobParametersTeamBuild(taskOptions.jobParameters)
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
        } else if (httpResponse.statusCode == 404) { // team-build plugin endpoint failed because it is not installed
            console.log('Install the "Team Foundation Server Plug-in" for improved Jenkins integration\n' + taskOptions.teamPluginUrl);
            taskOptions.teamBuildPluginAvailable = false;

            tl.debug('httpResponse: ' + JSON.stringify(httpResponse));
            let jobQueuePostData = addCrumb(taskOptions.parameterizedJob ?
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
                } else if (httpResponse.statusCode != 201) {
                    defer.reject(getFullErrorMessage(httpResponse, 'Job creation failed.'));
                } else {
                    var queueUri = addUrlSegment(httpResponse.headers.location, 'api/json');
                    defer.resolve(queueUri);
                }
            }).auth(taskOptions.username, taskOptions.password, true);
        } else if (httpResponse.statusCode != 201) {
            defer.reject(getFullErrorMessage(httpResponse, 'Job creation failed.'));
        } else {
            taskOptions.teamBuildPluginAvailable = true;
            let jsonBody = JSON.parse(body)
            let queueUri = addUrlSegment(jsonBody.created, 'api/json');
            defer.resolve(queueUri);
        }
    }).auth(taskOptions.username, taskOptions.password, true);

    return defer.promise;
}

function getCrumb(taskOptions: TaskOptions): Q.Promise<string> {
    let defer: Q.Deferred<string> = Q.defer<string>();
    let crumbRequestUrl: string = addUrlSegment(taskOptions.serverEndpointUrl, '/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)');
    tl.debug('crumbRequestUrl: ' + crumbRequestUrl);
    request.get({ url: crumbRequestUrl, strictSSL: taskOptions.strictSSL }, function(err, httpResponse, body) {
        if (err) {
            if (err.code == 'ECONNRESET') {
                tl.debug(err);
                defer.resolve(null);
            } else {
                defer.reject(err);
            }
        } else if (httpResponse.statusCode == 404) {
            tl.debug('crumb endpoint not found');
            taskOptions.crumb = taskOptions.NO_CRUMB;
            defer.resolve(taskOptions.NO_CRUMB);
        } else if (httpResponse.statusCode != 200) {
            failReturnCode(httpResponse, 'crumb request failed.');
            defer.reject(getFullErrorMessage(httpResponse, 'Crumb request failed.'));
        } else {
            taskOptions.crumb = body;
            tl.debug('crumb: ' + taskOptions.crumb);
            defer.resolve(taskOptions.crumb);
        }
    }).auth(taskOptions.username, taskOptions.password, true);
    return defer.promise;
}

export class StringWritable extends stream.Writable {

    value: string = "";

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
};

/**
 * Supported parameter types: boolean, string, choice, password
 * 
 * - If a parameter is not defined by Jenkins it is fine to pass it anyway
 * - Anything passed to a boolean parameter other than 'true' (case insenstive) becomes false.
 * - Invalid choice parameters result in a 500 response.
 * 
 */
function parseJobParameters(jobParameters: string[]): any {
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

function parseJobParametersTeamBuild(jobParameters: string[]): any {
    let formData: any = parseJobParameters(jobParameters);
    let jsonArray: any[] = [];
    for (var paramName in formData) {
        let json = {};
        json['name'] = paramName;
        json['value'] = formData[paramName];
        jsonArray.push(json);
    }
    return jsonArray;
}

function getTeamParameters(): any {
    var formData = {};
    allTeamBuildVariables.forEach(variableName => {
        let paramValue = tl.getVariable(variableName);
        if (paramValue) {
            formData[variableName] = paramValue;
        }
    });
    return formData;
}

//https://www.visualstudio.com/docs/build/define/variables
var allTeamBuildVariables: string[] = [
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