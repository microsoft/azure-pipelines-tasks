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

// Repeated query the server to determine if the task has finished.
// Returns true if the task is finished, or false if the timeout was exceeded without a positive answer from the server.
// Timeout and delay are in seconds, defaulting to 60 and 1 respectively if not specified
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

// Queries the server to determine if the task has finished, i.e. if the quality gate has been evaluated
export function isTaskComplete(taskReport:TaskReport):Q.Promise<boolean> {
    return getTaskDetails(taskReport)
        .then((responseJson:any) => {
            var taskStatus:string = responseJson.task.status;
            return (taskStatus.toUpperCase() == 'SUCCESS');
        });
}

// Query the server to determine the analysis id associated with the current task
export function getAnalysisId(taskReport:TaskReport):Q.Promise<string> {
    return getTaskDetails(taskReport)
        .then((analysisDetails:any) => {
            return getTaskAnalysisId(analysisDetails);
        });
}

function getTaskAnalysisId(analysisDetails:any):string {
    return analysisDetails.task.analysisId;
}

// Returns the status of the analysis identified by the argument.
export function getAnalysisStatus(analysisId:string):Q.Promise<string> {
    return getAnalysisDetails(analysisId)
        .then((analysisDetails:any) => {
            return getProjectStatus(analysisDetails);
        });
}

function getProjectStatus(qualityGateDetails:any):string {
    return qualityGateDetails.projectStatus.status;
}

export function getAnalysisDetails(analysisId:string):Q.Promise<Object> {
    try {
        return callSonarQubeRestEndpoint('/api/qualitygates/project_status?analysisId=' + analysisId)
            .then((response:RestResponse) => {
                var responseJson:any = response.payloadToJson();
                if (!responseJson.projectStatus) {
                    throw responseJson;
                }

                return responseJson;
            });
    } catch (error) {
        tl.debug('Could not fetch quality gate details on analysis ID' + analysisId);
        throw error;
    }
}

function getTaskDetails(taskReport:TaskReport):Q.Promise<Object> {
    if (!taskReport) {
        throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
    }

    try {
        return callSonarQubeRestEndpoint('/api/ce/task?id=' + taskReport.ceTaskId)
            .then((response:RestResponse) => {
                var responseJson:any = response.payloadToJson();
                if (!responseJson.task) {
                    throw responseJson;
                }

                return responseJson;
            });
    } catch (error) {
        tl.debug('Could not fetch task details on ID' + taskReport.ceTaskId);
        throw error;
    }
}

// Invokes a REST endpoint at the SonarQube server.
function callSonarQubeRestEndpoint(path:string):Q.Promise<RestResponse> {
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
            tl.debug('Got response: ' + serverResponseString + " from " + path);
            tl.debug(responseBody);
            var result:RestResponse = new RestResponse(response.statusCode, responseBody);
            if (!result.wasSuccess()) {
                defer.reject('Server responded with ' + serverResponseString);
            } else {
                defer.resolve(result);
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

// Constructs the options object used by the https.request() method. Takes the host-relative path i.e. '/' as an argument.
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