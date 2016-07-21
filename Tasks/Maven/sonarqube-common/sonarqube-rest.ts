/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import url = require('url');
import http = require('http');
import {IncomingMessage} from 'http';
import https = require('https');

import tl = require('../testlib/tasklib-wrapper');

import {TaskReport} from  './taskreport';
import {RestResponse} from  './restresponse';
import {SonarQubeEndpoint} from './sonarqube-common';
import sqCommon = require('./sonarqube-common');

/*
 SonarQube runs are represented in the API in two stages: tasks and analyses. The build system submits a task,
 which is a compute engine job. The task may take some time to finish, depending on the size and complexity of the build.

 Once the task is complete, its results become the analysis. This has quality gate and issues data available, and is used
 to create the build summary.
 */

/**
 * Repeatedly query the server to determine if the task has finished.
 * @param taskReport A TaskReport object for the analysis to wait for
 * @param timeout    (optional) Time, in seconds, to wait for the analysis job to finish before returning the promise as false.
 * @param delay      (optional) Time, in seconds, to wait between polling attempts. Warning: Does not also wait for previous request to finish.
 * @returns A promise resolving true if the task finished, false if the timeout was exceeded, or rejecting if there was an error.
 */
export function waitForAnalysisCompletion(taskReport:TaskReport, timeout?:number, delay?:number):Q.Promise<boolean> {
    var defer = Q.defer<boolean>();

    // Default values
    var timeout = timeout || 60;
    var delay = delay || 1;

    var isDone:boolean = false;
    // Every [delay] seconds, call isAnalysisComplete()
    var intervalObject = setInterval((taskReport) => {
        isTaskComplete(taskReport)
            .then((isDone:boolean) => {
                if (isDone) {
                    clearInterval(intervalObject);
                    defer.resolve(true);
                }
            })
            .fail((error) => {
                // If anything goes wrong, delete the repeating call and reject.
                clearInterval(intervalObject);
                defer.reject(error);
            })
    }, delay * 1000, taskReport);

    // After [timeout] seconds, delete the repeating call and return false.
    setTimeout((intervalObject) => {
        clearInterval(intervalObject);
        defer.resolve(false);
    }, timeout * 1000, intervalObject);

    return defer.promise;
}

/**
 * Queries the server to determine if the task has finished, i.e. if the quality gate has been evaluated
 * @param  taskReport A TaskReport object for the analysis to fetch the completion status of
 * @returns A promise, resolving true if the task has finished and false if it has not. Rejects on error.
 */
function isTaskComplete(taskReport:TaskReport):Q.Promise<boolean> {
    return getTaskDetails(taskReport)
        .then((responseJson:any) => {
            var taskStatus:string = responseJson.task.status;
            return (taskStatus.toUpperCase() == 'SUCCESS');
        });
}

/**
 * Query the server to determine the analysis ID associated with the current task
 * @param taskReport A TaskReport object for the task to fetch the analysis ID of
 * @returns A promise, resolving with a string representing the analysis ID. Rejects on error.
 */
export function getAnalysisId(taskReport:TaskReport):Q.Promise<string> {
    return getTaskDetails(taskReport)
        .then((analysisDetails:any) => {
            return getTaskAnalysisId(analysisDetails);
        });
}

/**
 * Returns the analysis ID from a task JSON object.
 * @param taskDetails A JSON object representation of the task
 * @returns The analysis ID associated with the task
 */
function getTaskAnalysisId(taskDetails:any):string {
    return taskDetails.task.analysisId;
}

/**
 * Returns the status of the analysis identified by the argument.
 * @param analysisId String representing the ID of the analysis to fetch the status of
 * @returns String representing the result of the project analysis
 */
export function getAnalysisStatus(analysisId:string):Q.Promise<string> {
    return getAnalysisDetails(analysisId)
        .then((analysisDetails:any) => {
            return getProjectStatus(analysisDetails);
        });
}


/**
 * Returns the status of the project under analysis.
 * @param analysisDetails A JSON object representation of the analysis
 * @returns String representing the result of the project analysis
 */
function getProjectStatus(analysisDetails:any):string {
    return analysisDetails.projectStatus.status;
}

/**
 * Makes a RESTful API call to get analysis details (e.g. quality gate status)
 * @param analysisId String representing the ID of the analysis to fetch details for
 * @returns JSON object representation of the analysis details
 */
export function getAnalysisDetails(analysisId:string):Q.Promise<Object> {
    return callSonarQubeRestEndpoint('/api/qualitygates/project_status?analysisId=' + analysisId)
        .then((responseJson:any) => {
            if (!responseJson.projectStatus) {
                tl.debug('Could not fetch quality gate details on analysis ID' + analysisId);
                return Q.reject(new Error(tl.loc('sqCommon_InvalidResponseFromServer')));
            }

            return responseJson;
        });
}

/**
 * Makes a RESTful API call to get task details (e.g. quality gate status)
 * @param taskReport A TaskReport object for the analysis to fetch the details of
 * @returns JSON object representation of the task details
 */
function getTaskDetails(taskReport:TaskReport):Q.Promise<Object> {
    if (!taskReport) {
        return Q.reject(tl.loc('sqAnalysis_TaskReportInvalid'));
    }

    return callSonarQubeRestEndpoint('/api/ce/task?id=' + taskReport.ceTaskId)
        .then((responseJsonObject:any) => {
            if (!responseJsonObject || !responseJsonObject.task) {
                return Q.reject(new Error('Invalid response when requesting task details for ID ' + taskReport.ceTaskId));
            }

            return responseJsonObject;
        })
        .fail((err) => {
            if (err && err.message) {
                tl.debug(err.message);
            }

            tl.debug('Could not fetch task details on ID' + taskReport.ceTaskId);
            return Q.reject(new Error(tl.loc('sqCommon_InvalidResponseFromServer')));
        })
}

/**
 * Invokes a REST endpoint on the SonarQube server.
 * @param path The host-relative path to the REST endpoint (e.g. /api/ce/task)
 * @returns A promise, resolving with a JSON object representation of the response. Rejects on error or non-200 header.
 */
function callSonarQubeRestEndpoint(path:string):Q.Promise<Object> {
    var defer = Q.defer<RestResponse>();

    var options:any = createSonarQubeHttpRequestOptions(path);

    // Dynamic switching - we cannot use https.request() for http:// calls or vice versa
    var protocolToUse;
    switch (options.protocol) {
        case 'http':
            protocolToUse = http;
            break;
        case 'https':
            protocolToUse = https;
            break;
        default:
            protocolToUse = http;
            break;
    }

    var responseBody:string = '';
    var request = protocolToUse.request(options, (response:IncomingMessage) => {

        response.on('data', function (body) {
            responseBody += body;
        });

        response.on('end', function () {
            var serverResponseString:string = response.statusCode + " " + http.STATUS_CODES[response.statusCode];

            // HTTP response codes between 200 and 299 inclusive are successes
            if (!(result.statusCode >= 200 && result.statusCode < 300)) {
                defer.reject(new Error('Server responded with ' + serverResponseString));
            } else {
                tl.debug('Got response: ' + serverResponseString + " from " + path);

                if (!responseBody || responseBody.length < 1) {
                    defer.resolve({});
                } else {
                    defer.resolve(JSON.parse(responseBody));
                }
            }
        });
    });

    request.on('error', (error) => {
        tl.debug('Failed to call ' + path);
        defer.reject(error);
    });

    tl.debug('Sending request to: ' + path);
    request.end();
    return defer.promise;
}

/**
 * Constructs the options object used by the http/https request() method.
 * Defaults to an HTTP request on port 80 to the relative path '/'.
 * @param path The host-relative path to the REST endpoint (e.g. /api/ce/task)
 * @returns An options object to be passed to the request() method
 */
function createSonarQubeHttpRequestOptions(path?:string):Object {
    const endpoint:SonarQubeEndpoint = sqCommon.getSonarQubeEndpoint();

    var hostUrl:url.Url = url.parse(endpoint.Url);
    var authUser = endpoint.Username || '';
    var authPass = endpoint.Password || '';

    var options = {
        method: 'GET',
        protocol: hostUrl.protocol || 'http',
        host: hostUrl.hostname,
        port: hostUrl.port || 80,
        path: path || '/',
        auth: authUser + ':' + authPass,
        headers: {
        }
    };

    return options;
}