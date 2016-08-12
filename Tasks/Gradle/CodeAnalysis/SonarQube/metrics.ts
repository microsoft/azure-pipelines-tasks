/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');

import tl = require('vsts-task-lib/task');
import {TaskResult} from 'vsts-task-lib/task';

import {SonarQubeEndpoint} from './endpoint';
import sqCommon = require('./common');
import {ISonarQubeServer} from  './server';

/*
 SonarQube runs are represented in the API in two stages: tasks and analyses. The build system submits a task,
 which is a compute engine job. The task may take some time to finish, depending on the size and complexity of the build.

 Once the task is complete, its results become the analysis. This has quality gate and issues data available, and is used
 to create the build summary.
 */

/**
 * The metrics methods and data for a given build.
 */
export class SonarQubeMetrics {

    private server:ISonarQubeServer;
    private taskId:string;

    private timeout:number;
    private delay:number;

    // cached data to speed up operations
    private analysisComplete:boolean = false;
    private analysisId:string = null;
    private taskDetails:any = null;
    private analysisDetails:any = null;

    /**
     * Construct a new SonarQubeMetrics instance with a specified SonarQubeServer and task ID.
     * @param server  Server the task was sent to
     * @param taskId  A string identifying the task
     * @param timeout (optional) Time, in seconds, to wait for the analysis job to finish before returning the promise as false.
     * @param delay   (optional) Time, in seconds, to wait between polling attempts. Warning: Does not also wait for previous request to finish.
     */
    constructor(server:ISonarQubeServer, taskId:string, timeout?:number, delay?:number) {
        this.server = server;
        this.taskId = taskId;

        if (timeout == undefined) {
            timeout = 300;
        }
        if (delay == undefined) {
            delay = 1;
        }
        this.timeout = timeout;
        this.delay = delay;
    }

    /**
     * Returns true if the quality gate has failed.
     * @returns {Promise<boolean>} True if the quality gate has failed, false if the quality gate passed or is warning.
     */
    public static hasQualityGateFailed(qualityGateStatus:string): boolean {
        return qualityGateStatus.toUpperCase() == 'ERROR';
    }

    /**
     * Retrieves the quality gate status of the SonarQube analysis task of this SonarQubeMetrics instance.
     * Waits for the analysis task to complete, if necessary.
     * @returns {Promise<string>} The quality gate status, as reported by the SonarQube server.
     */
    public getQualityGateStatus(): Q.Promise<string> {
        return this.getAnalysisId()
            .then((analysisId:string) => {
                return this.getAnalysisStatus(analysisId);
            })
    }

    /**
     * Returns the appropriate TaskResult enum based on whether the quality gate failed or passed.
     * @returns {any}
     */
    public getTaskResultFromQualityGateStatus(): Q.Promise<TaskResult> {
        return this.getQualityGateStatus()
            .then((qualityGateStatus:string) => {
                if (SonarQubeMetrics.hasQualityGateFailed(qualityGateStatus)) {
                    return TaskResult.Failed;
                }

                return TaskResult.Succeeded;
            });
    }

    /**
     * Repeatedly query the server to determine if the task has finished.
     * @param timeout    (optional) Time, in seconds, to wait for the analysis job to finish before returning the promise as false.
     * @param delay      (optional) Time, in seconds, to wait between polling attempts. Warning: Does not also wait for previous request to finish.
     * @returns A promise resolving true if the task finished or rejecting if there was an error or the timeout was exceeded.
     */
    private waitForTaskCompletion(timeout?:number, delay?:number):Q.Promise<boolean> {
        // If we have previously waited, then we can immediately return true.
        if (this.analysisComplete) {
            return Q.when(true);
        }

        var defer = Q.defer<boolean>();

        // Default values
        var timeout = timeout || this.timeout;
        var delay = delay || this.delay;

        // Every [delay] seconds, call isAnalysisComplete()
        var intervalTask = setInterval(() => {
            this.isTaskComplete()
                .then((isDone:boolean) => {
                    if (isDone) {
                        // analysis is complete, set the cache (there should be no further state changes)
                        this.analysisComplete = true;
                        this.getTaskDetails()
                            .then((taskDetails:Object) => {
                                this.taskDetails = taskDetails;
                                this.analysisId = SonarQubeMetrics.getTaskAnalysisId(taskDetails);

                                return this.getAnalysisDetails(this.analysisId);
                            })
                            .then((analysisDetails:Object) => {
                                this.analysisDetails = analysisDetails;
                            });

                        defer.resolve(this.analysisComplete);
                    }
                })
                .fail((error) => {
                    // If anything goes wrong, reject
                    defer.reject(error);
                })
        }, delay * 1000);

        // After [timeout] seconds, reject.
        var timeoutTask = setTimeout(() => {
            if (!this.analysisComplete) {
                tl.debug(`Did not receive a success response before the timeout (${timeout}s) expired.`);
                defer.reject(new Error(tl.loc('sqAnalysis_AnalysisTimeout', timeout)));
            }
        }, timeout * 1000);

        return defer.promise
            .fin(() => {
                // Upon exit, clear the repeating and delayed tasks.
                clearInterval(intervalTask);
                clearTimeout(timeoutTask);
            });
    }

    /**
     * Queries the server to determine if the task has finished, i.e. if the quality gate has been evaluated
     * @returns A promise, resolving true if the task has finished and false if it has not. Rejects on error.
     */
    private isTaskComplete():Q.Promise<boolean> {
        return this.getTaskDetails()
            .then((responseJson:any) => {
                var taskStatus:string = responseJson.task.status;
                return (taskStatus.toUpperCase() == 'SUCCESS');
            });
    }

    /**
     * Query the server to determine the analysis ID associated with the current task.
     * Waits for analysis task to complete, if necessary.
     * @returns A promise, resolving with a string representing the analysis ID. Rejects on error.
     */
    private getAnalysisId():Q.Promise<string> {
        return this.waitForTaskCompletion()
            .then(() => {
                return this.getTaskDetails();
            })
            .then((taskDetails:any) => {
                return SonarQubeMetrics.getTaskAnalysisId(taskDetails);
            });
    }

    /**
     * Returns the status of the analysis identified by the argument.
     * @param analysisId String representing the ID of the analysis to fetch the status of
     * @returns String representing the result of the project analysis
     */
    private getAnalysisStatus(analysisId:string):Q.Promise<string> {
        return this.getAnalysisDetails(analysisId)
            .then((analysisDetails:any) => {
                return SonarQubeMetrics.getProjectStatus(analysisDetails);
            });
    }

    /**
     * Makes a RESTful API call to get analysis details (e.g. quality gate status)
     * Returns from the cache if analysis has completed.
     * @param analysisId (optional) String representing the ID of the analysis to fetch details for. If not specified, cached ID will be used
     * @returns JSON object representation of the analysis details
     */
    private getAnalysisDetails(analysisId?:string):Q.Promise<Object> {
        if (this.analysisDetails != null) {
            return Q.when(this.analysisDetails);
        }

        if (analysisId == undefined || analysisId == null) {
            analysisId = this.analysisId;
        }

        return this.server.invokeApiCall('/api/qualitygates/project_status?analysisId=' + analysisId)
            .then((responseJson:any) => {
                if (!responseJson.projectStatus) {
                    tl.debug('Could not fetch quality gate details on analysis ID' + analysisId);
                    return Q.reject(new Error(tl.loc('sqCommon_InvalidResponseFromServer')));
                }

                return responseJson;
            });
    }

    /**
     * Makes a RESTful API call to get task details (e.g. quality gate status).
     * Returns from the cache if analysis has completed.
     * @returns JSON object representation of the task details
     */
    private getTaskDetails():Q.Promise<Object> {
        if (this.taskDetails != null) {
            return Q.when(this.taskDetails);
        }

        return this.server.invokeApiCall('/api/ce/task?id=' + this.taskId)
            .then((responseJsonObject:any) => {
                if (!responseJsonObject || !responseJsonObject.task) {
                    return Q.reject(new Error(`Invalid response when requesting task details for ID ${this.taskId}`));
                }

                return responseJsonObject;
            })
            .fail((err) => {
                if (err && err.message) {
                    tl.debug(err.message);
                }

                tl.debug(`Could not fetch task details on ID ${this.taskId}`);
                return Q.reject(new Error(tl.loc('sqCommon_InvalidResponseFromServer')));
            })
    }

    /* Static helper methods */

    /**
     * Returns the analysis ID from a task JSON object.
     * @param taskDetails A JSON object representation of the task
     * @returns The analysis ID associated with the task
     */
    private static getTaskAnalysisId(taskDetails:any):string {
        return taskDetails.task.analysisId;
    }

    /**
     * Returns the status of the project under analysis.
     * @param analysisDetails A JSON object representation of the analysis
     * @returns String representing the result of the project analysis
     */
    private static getProjectStatus(analysisDetails:any):string {
        return analysisDetails.projectStatus.status;
    }
}