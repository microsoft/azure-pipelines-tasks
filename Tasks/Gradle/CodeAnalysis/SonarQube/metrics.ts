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
    private measurementUnits:SonarQubeMeasurementUnit[] = null;

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
     * Returns the status of the project under analysis (the quality gate status)
     * @param analysisDetails A JSON object representation of the analysis
     * @returns String representing the result of the project analysis
     */
    public static getQualityGateStatus(analysisDetails:any):string {
        return analysisDetails.projectStatus.status;
    }

    /**
     * Returns true if the quality gate has failed.
     * @returns {Promise<boolean>} True if the quality gate has failed, false if the quality gate passed or is warning.
     */
    public static hasQualityGateFailed(qualityGateStatus:string): boolean {
        return qualityGateStatus.toUpperCase() == 'ERROR';
    }

    /**
     * Returns true if the quality gate has warned.
     * @returns {Promise<boolean>} True if the quality gate has warned, false if the quality gate passed or failed.
     */
    public static hasQualityGateWarned(qualityGateStatus:string): boolean {
        return qualityGateStatus.toUpperCase() == 'WARN';
    }

    /**
     * Returns a list of reasons why the quality gate failed. Does not return unviolated failure conditions.
     * @param analysisDetails JSON-decoded object representing the analysis details
     * @returns {SonarQubeFailureCondition[]} Array of violated failure conditions
     */
    public static getFailedConditions(analysisDetails:any):SonarQubeFailureCondition[] {
        var result:SonarQubeFailureCondition[] = [];
        analysisDetails.projectStatus.conditions.forEach((condition:any) => {
            var sqCondition = condition as SonarQubeFailureCondition;

            // Only add the condition if they caused the quality gate to warn or fail, otherwise skip it
            if (sqCondition.status.toUpperCase() == 'WARN' || sqCondition.status.toUpperCase() == 'ERROR') {
                result.push(sqCondition);
            }
        });
        return result;
    }

    /**
     * Makes a RESTful API call to get analysis details (e.g. quality gate status)
     * Returns from the cache if analysis has completed.
     * @param analysisId (optional) String representing the ID of the analysis to fetch details for.
     *     If not specified, cached ID will be used or analysisId will be fetched
     * @returns JSON object representation of the analysis details
     */
    public fetchAnalysisDetails(analysisId?:string):Q.Promise<Object> {
        // Use the cache if available
        if (!(this.analysisDetails == undefined || this.analysisDetails == null)) {
            return Q.when(this.analysisDetails);
        }

        // If analysisId was not given, get it (either from cache or live)
        if (analysisId == undefined || analysisId == null) {
            return this.fetchAnalysisId()
                .then((analysisId:string) => {
                    return this.fetchAnalysisDetails(analysisId);
                });
        }

        return this.server.invokeApiCall('/api/qualitygates/project_status?analysisId=' + analysisId)
            .then((responseJson:any) => {
                if (!responseJson.projectStatus) {
                    tl.debug('Could not fetch quality gate details on analysis ID' + analysisId);
                    return Q.reject(new Error(tl.loc('sqCommon_InvalidResponseFromServer')));
                }

                this.analysisDetails = responseJson;
                return this.analysisDetails;
            });
    }

    /**
     * Retrieves the quality gate status of the SonarQube analysis task of this SonarQubeMetrics instance.
     * Waits for the analysis task to complete, if necessary.
     * @returns {Promise<string>} The quality gate status, as reported by the SonarQube server.
     */
    public fetchQualityGateStatus(): Q.Promise<string> {

        tl.debug(`[SQ] Getting the quality gate status `);

        if (SonarQubeMetrics.isCached(this.analysisDetails)) {
            return Q.when(SonarQubeMetrics.getQualityGateStatus(this.analysisDetails));
        }

        return this.fetchAnalysisId()
            .then((analysisId:string) => {
                tl.debug(`[SQ] Analysis ID: ${analysisId}`);
                return this.fetchAnalysisStatus(analysisId);
            })
            .then((analysisStatus:string) => {
                tl.debug(`[SQ] Analysis status: ${analysisStatus}`);
                return analysisStatus;
            });
    }

    /**
     * Returns the appropriate TaskResult enum based on whether the quality gate failed or passed.
     * @returns {any}
     */
    public fetchTaskResultFromQualityGateStatus(): Q.Promise<TaskResult> {
        return this.fetchQualityGateStatus()
            .then((qualityGateStatus:string) => {
                if (SonarQubeMetrics.hasQualityGateFailed(qualityGateStatus)) {
                    return TaskResult.Failed;
                }

                return TaskResult.Succeeded;
            });
    }

    /**
     * For all the units used by the server, this method returns the key and the friendly name, as well as the type and the id
     * @returns {Promise<Object>} A list of all units used by the SQ server, represented by objects with fields: id, key, type, name. Rejects if server response was invalid.
     */
    public fetchMeasurementDetails():Q.Promise<SonarQubeMeasurementUnit[]> {
        if (SonarQubeMetrics.isCached(this.measurementUnits)) {
            tl.debug(`[SQ] Measurement units cache hit (cached array length ${this.measurementUnits.length})`);
            return Q.when(this.measurementUnits);
        }

        return this.server.invokeApiCall('/api/metrics/search?ps=500&f=name')
            .then((response:any) => {
                return Q.Promise<SonarQubeMeasurementUnit[]>((resolve, reject) => {
                    if ((response == undefined || response == null) ||
                        (response.metrics == undefined || response.metrics == null)) {
                        reject(new Error(tl.loc('sqAnalysis_NoUnitsFound')));
                    } else {
                        this.measurementUnits = response.metrics;
                        resolve(Q.when(this.measurementUnits));
                    }

                });
            });
    }

    /**
     * Repeatedly query the server to determine if the task has finished.
     * @param timeout    (optional) Time, in seconds, to wait for the analysis job to finish before returning the promise as false.
     * @param delay      (optional) Time, in seconds, to wait between polling attempts. Warning: Does not also wait for previous request to finish.
     * @returns A promise resolving true if the task finished or rejecting if there was an error or the timeout was exceeded.
     */
    private waitForTaskCompletion(timeout?:number, delay?:number):Q.Promise<boolean> {
        tl.debug(`[SQ] Waiting for SonarQube analysis to complete.`);

        // If we have previously waited, then we can immediately return true.
        if (this.analysisComplete) {
            tl.debug(`[SQ] Analysis already cached as complete.`);
            return Q.when(true);
        }

        // Call isTaskComplete immediately
        return this.isTaskComplete()
            .then((isDone:boolean) => {
                // If done on the first try, return fast
                if (isDone) {
                    return Q.resolve(true);
                }

                // Otherwise, setup the delayed/repeating wait task
                return this.setupTaskCompleteWait(timeout, delay);
            });
    }

    /**
     * Implementation of the system to repeatedly query the server until the task has completed.
     * Because of a detail of the implementation, the minimum time to wait is ${delay} seconds.
     * @param timeout    (optional) Time, in seconds, to wait for the analysis job to finish before returning the promise as false.
     * @param delay      (optional) Time, in seconds, to wait between polling attempts. Warning: Does not also wait for previous request to finish.
     * @returns A promise resolving true if the task finished or rejecting if there was an error or the timeout was exceeded.
     */
    private setupTaskCompleteWait(timeout?:number, delay?:number):Q.Promise<boolean> {
        var defer = Q.defer<boolean>();

        // Default values
        var timeout = timeout || this.timeout;
        var delay = delay || this.delay;// Every [delay] seconds, call isTaskComplete()

        var intervalTask = setInterval(() => {
            this.isTaskComplete()
                .then((isDone:boolean) => {
                    if (isDone) {
                        defer.resolve(this.analysisComplete);
                    }
                })
                .fail((error) => {
                    defer.reject(error); // If anything goes wrong, reject
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
        return this.fetchTaskDetails()
            .then((responseJson:any) => {
                var taskStatus:string = responseJson.task.status;
                tl.debug(`[SQ] Analysis status: ${taskStatus} `);

                if (taskStatus.toUpperCase() == 'SUCCESS') {
                    tl.debug(`[SQ] Analysis complete`);
                    return true;
                }

                if (taskStatus.toUpperCase() == 'FAILED') {
                    tl.debug(`[SQ] Analysis failed (fatal error)`);
                }

                return false;
            });
    }

    /**
     * Query the server to determine the analysis ID associated with the current task.
     * Waits for analysis task to complete, if necessary.
     * @returns A promise, resolving with a string representing the analysis ID. Rejects on error.
     */
    private fetchAnalysisId():Q.Promise<string> {
        if (this.analysisId != undefined && this.analysisId != null) {
            return Q.when(this.analysisId);
        }

        return this.waitForTaskCompletion()
            .then(() => {
                return this.fetchTaskDetails();
            })
            .then((taskDetails:any) => {
                this.analysisId = SonarQubeMetrics.getTaskAnalysisId(taskDetails);
                return this.analysisId;
            });
    }

    /**
     * Returns the status of the analysis identified by the argument.
     * @param analysisId String representing the ID of the analysis to fetch the status of
     * @returns Promise resolving to a string representing the result of the project analysis
     */
    private fetchAnalysisStatus(analysisId:string):Q.Promise<string> {
        return this.fetchAnalysisDetails(analysisId)
            .then((analysisDetails:any) => {
                return SonarQubeMetrics.getQualityGateStatus(analysisDetails);
            });
    }

    /**
     * Makes a RESTful API call to get task details (e.g. quality gate status).
     * Returns from the cache if analysis has completed.
     * @returns JSON object representation of the task details
     */
    private fetchTaskDetails():Q.Promise<Object> {
        if (this.taskDetails != null) {
            return Q.when(this.taskDetails);
        }

        return this.server.invokeApiCall('/api/ce/task?id=' + this.taskId)
            .then((responseJsonObject:any) => {
                if (!responseJsonObject || !responseJsonObject.task) {
                    return Q.reject(new Error(`Invalid response when requesting task details for ID ${this.taskId}`));
                }

                var taskStatus:string = responseJsonObject.task.status;

                // caching
                if (taskStatus.toUpperCase() == 'SUCCESS' || taskStatus.toUpperCase() == 'FAILED') {
                    // task is complete, set the cache (there should be no further state changes)
                    this.analysisComplete = true;
                    this.taskDetails = responseJsonObject;
                }

                // if task failed, reject
                if (taskStatus.toUpperCase() == 'FAILED') {
                    return Q.reject(new Error(`Server returned FAILED status for task ${this.taskId}`));
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
     * Returns true if variable is cached (i.e. variable is not undef or null)
     * @param cachedVar
     * @returns {boolean}
     */
    private static isCached(cachedVar:any):boolean {
        return (!(cachedVar == undefined || cachedVar == null));
    }
}

/**
 * Simple data class to represent a failure condition of a quality gate. Usually shown as the reason(s) a quality gate failed.
 * Each SonarQubeFailureCondition is a fully self-contained unit of information.
 */
export class SonarQubeFailureCondition {
    constructor(public status:string, public metricKey:string, public comparator:string, public warningThreshold:string, public errorThreshold:string, public actualValue:string) {
    }
}

/**
 * Simple data class to represent a measurement unit used by SonarQube (e.g. a line of code, a minute of work, a blocking issue)
 */
export class SonarQubeMeasurementUnit {
    constructor(public id:string, public key:string, public type:string, public name:string) {
    }
}