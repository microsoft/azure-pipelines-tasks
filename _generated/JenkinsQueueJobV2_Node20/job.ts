// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import os = require('os');
import path = require('path');
import url = require('url');
import request = require('request');

import { JobSearch } from './jobsearch';
import { JobQueue } from './jobqueue';
import { unzip } from './unzip';
import {JobState, checkStateTransitions} from './states';

import * as Util from './util';

export class Job {
    public Parent: Job; // if this job is a pipelined job, its parent that started it.
    public Children: Job[] = []; // any pipelined jobs
    public Joined: Job; // if this job is joined, the main job that is running
    public Search: JobSearch;
    private queue: JobQueue;

    public TaskUrl: string; // URL for the job definition

    public State: JobState = JobState.New;
    public ExecutableUrl: string; // URL for the executing job instance
    public ExecutableNumber: number;
    public Name: string;
    public Identifier: string; // a job identifier that takes into account folder structure
    private jobConsole: string = '';
    private jobConsoleOffset: number = 0;
    private jobConsoleEnabled: boolean = false;

    private working: boolean = true; // initially mark it as working
    private workDelay: number = 0;
    private retryNumber: number;

    public ParsedExecutionResult: {result: string, timestamp: number}; // set during state Finishing

    constructor(jobQueue: JobQueue, parent: Job, taskUrl: string, executableUrl: string, executableNumber: number, name: string) {
        this.Parent = parent;
        this.TaskUrl = taskUrl;
        this.ExecutableUrl = executableUrl;
        this.ExecutableNumber = executableNumber;
        this.Name = name;
        if (this.Parent != null) {
            this.Parent.Children.push(this);
        }
        this.queue = jobQueue;
        this.retryNumber = 0;
        if (this.TaskUrl.startsWith(this.queue.TaskOptions.serverEndpointUrl)) {
            // simplest case (jobs run on the same server name as the endpoint)
            this.Identifier = this.TaskUrl.substr(this.queue.TaskOptions.serverEndpointUrl.length);
        } else {
            // backup check in case job is running on a different server name than the endpoint
            this.Identifier = url.parse(this.TaskUrl).path.substr(1);
            const jobStringIndex: number = this.Identifier.indexOf('job/');
            if (jobStringIndex > 0) {
                // can fall into here if the jenkins endpoint is not at the server root; e.g. serverUrl/jenkins instead of serverUrl
                this.Identifier = this.Identifier.substr(jobStringIndex);
            }
        }
        this.queue.AddJob(this);

        this.debug('created');
        this.initialize();
    }

    /**
     * All changes to the job state should be routed through here.
     * This defines all and validates all state transitions.
     */
    private changeState(newState: JobState) {
        const currentState: JobState = this.State;
        this.debug(`state changed from ${JobState[currentState]} to ${JobState[newState]}`);

        const validStateChange: boolean = checkStateTransitions(currentState, newState);
        if (!validStateChange) {
            Util.fail(`Invalid state change from: ${JobState[currentState]} to: ${JobState[newState]} ${this}`);
        }

        this.State = newState;
    }

    public DoWork() {
        if (this.working) { // return if already working
            return;
        } else {
            this.working = true;
            setTimeout(() => {
                switch (this.State) {
                    case (JobState.New): {
                        this.initialize();
                        break;
                    }

                    case (JobState.Streaming): {
                        this.streamConsole();
                        break;
                    }

                    case (JobState.Downloading): {
                        this.downloadResults();
                        break;
                    }

                    case (JobState.Finishing): {
                        this.finish();
                        break;
                    }

                    default: {
                        // usually do not get here, but this can happen if another callback caused this job to be joined
                        this.stopWork(this.queue.TaskOptions.pollIntervalMillis, null);
                        break;
                    }
                }
            }, this.workDelay);
        }
    }

    private stopWork(delay: number, jobState: JobState) {
        if (jobState && jobState !== this.State) {
            this.changeState(jobState);
            if (!this.IsActive()) {
                this.queue.FlushJobConsolesSafely();
            }
        }
        this.workDelay = delay;
        this.working = false;
    }

    
    private RetryConnection(): void {
        this.retryNumber++;
        this.consoleLog(`Connection error. Retrying again in ${this.queue.TaskOptions.delayBetweenRetries} seconds. Retry ${this.retryNumber} out of ${this.queue.TaskOptions.retryCount}`);
        this.stopWork(this.queue.TaskOptions.delayBetweenRetries*1000, this.State);
    }

    public IsActive(): boolean {
        return this.State === JobState.New ||
            this.State === JobState.Locating ||
            this.State === JobState.Streaming ||
            this.State === JobState.Downloading ||
            this.State === JobState.Finishing;
    }

    private getBlockMessage(message: string): string {
        const divider: string = '******************************************************************************';
        const blockMessage: string = divider + '\n' + message + ' \n' + divider;
        return blockMessage;
    }

    public SetStreaming(executableNumber: number): void {
        // If we aren't waiting for the job to finish then we should end it now
        if (!this.queue.TaskOptions.captureConsole) { // transition to Finishing
            this.changeState(JobState.Streaming);
            this.changeState(JobState.Finishing);
            return;
        }
        if (this.State === JobState.New || this.State === JobState.Locating) {
            this.ExecutableNumber = executableNumber;
            this.ExecutableUrl = Util.addUrlSegment(this.TaskUrl, this.ExecutableNumber.toString());
            this.changeState(JobState.Streaming);
            // log the jobs starting block
            this.consoleLog(this.getBlockMessage('Jenkins job started: ' + this.Name + '\n' + this.ExecutableUrl));
            // log any pending jobs
            if (this.queue.FindActiveConsoleJob() == null) {
                console.log('Jenkins job pending: ' + this.ExecutableUrl);
            }
        } else if (this.State === JobState.Joined || this.State === JobState.Cut) {
            Util.fail('Can not be set to streaming: ' + this);
        }
        this.joinOthersToMe();
    }

    private joinOthersToMe() {
        //join all other siblings to this same job (as long as it's not root)
        const thisJob: Job = this;
        if (thisJob.Parent != null) {
            thisJob.Search.DetermineMainJob(thisJob.ExecutableNumber, function (mainJob: Job, secondaryJobs: Job[]) {
                if (mainJob != thisJob) {
                    Util.fail('Illegal call in joinOthersToMe(), job:' + thisJob);
                }
                for (const i in secondaryJobs) {
                    const secondaryJob: Job = secondaryJobs[i];
                    if (secondaryJob.State !== JobState.Cut) {
                        secondaryJob.SetJoined(thisJob);
                    }
                }
            });
        }
    }

    public SetJoined(joinedJob: Job): void {
        tl.debug(this + '.setJoined(' + joinedJob + ')');
        this.Joined = joinedJob;
        this.changeState(JobState.Joined);
        if (joinedJob.State === JobState.Joined || joinedJob.State === JobState.Cut) {
            Util.fail('Invalid join: ' + this);
        }

        // recursively cut all children
        for (const i in this.Children) {
            this.Children[i].Cut();
        }
    }

    public Cut(): void {
        this.changeState(JobState.Cut);
        for (const i in this.Children) {
            this.Children[i].Cut();
        }
    }

    private setParsedExecutionResult(parsedExecutionResult: {result: string, timestamp: number}) {
        this.ParsedExecutionResult = parsedExecutionResult;
        //log the job's closing block
        this.consoleLog(this.getBlockMessage('Jenkins job finished: ' + this.Name + '\n' + this.ExecutableUrl));
    }

    public GetTaskResult(): number {
        if (this.State === JobState.Queued) {
            return tl.TaskResult.Succeeded;
        } else if (this.State === JobState.Done) {
            const resultCode = this.ParsedExecutionResult.result.toUpperCase();
            if (resultCode == 'SUCCESS' || (resultCode == 'UNSTABLE' && !this.queue.TaskOptions.failOnUnstableResult)) {
                return tl.TaskResult.Succeeded;
            } else {
                return tl.TaskResult.Failed;
            }
        }
        return tl.TaskResult.Failed;
    }

    public GetResultString(): string {
        if (this.State === JobState.Queued) {
            return 'Queued';
        } else if (this.State === JobState.Done) {
            const resultCode: string = this.ParsedExecutionResult.result.toUpperCase();
            // codes map to fields in http://hudson-ci.org/javadoc/hudson/model/Result.html
            if (resultCode == 'SUCCESS') {
                return tl.loc('succeeded');
            } else if (resultCode == 'UNSTABLE') {
                return tl.loc('unstable');
            } else if (resultCode == 'FAILURE') {
                return tl.loc('failed');
            } else if (resultCode == 'NOT_BUILT') {
                return tl.loc('notbuilt');
            } else if (resultCode == 'ABORTED') {
                return tl.loc('aborted');
            } else {
                return resultCode;
            }
        } else {
            return tl.loc('unknown');
        }
    }

    private initialize() {
        const thisJob: Job = this;
        thisJob.Search.Initialize().then(() => {
            if (thisJob.Search.Initialized) {
                if (thisJob.queue.TaskOptions.capturePipeline) {
                    const downstreamProjects = thisJob.Search.ParsedTaskBody.downstreamProjects || [];
                    downstreamProjects.forEach((project) => {
                        if (project.color !== 'disabled') {
                            new Job(thisJob.queue, thisJob, project.url, null, -1, project.name); // will add a new child to the tree
                        }
                    });
                }
                thisJob.Search.ResolveIfKnown(thisJob); // could change state
                const newState: JobState = (thisJob.State === JobState.New) ? JobState.Locating : thisJob.State; // another call back could also change state
                const nextWorkDelay: number = (newState === JobState.Locating) ? thisJob.queue.TaskOptions.pollIntervalMillis : thisJob.workDelay;
                thisJob.stopWork(nextWorkDelay, newState);
            } else {
                //search not initialized, so try again
                thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
            }
        }).fail((err) => {
            throw err;
        });
    }

    /**
     * Checks the success of the job
     *
     * JobState = Finishing, transition to Downloading, Done, or Queued possible
     */
    private finish(): void {
        const thisJob: Job = this;
        tl.debug('finish()');
        if (!thisJob.queue.TaskOptions.captureConsole) { // transition to Queued
            thisJob.stopWork(0, JobState.Queued);
        } else { // stay in Finishing, or eventually go to Done
            const resultUrl: string = Util.addUrlSegment(thisJob.ExecutableUrl, 'api/json?tree=result,timestamp');
            thisJob.debug('Tracking completion status of job: ' + resultUrl);
            request.get({ url: resultUrl, strictSSL: thisJob.queue.TaskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
                tl.debug('finish().requestCallback()');
                if (err) {
                    Util.handleConnectionResetError(err); // something went bad
                    thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
                    return;
                } else if (httpResponse.statusCode !== 200) {
                    console.error(`Job was killed because of an response with unexpected status code from Jenkins - ${httpResponse.statusCode}`);
                    Util.failReturnCode(httpResponse, 'Job progress tracking failed to read job result');
                    thisJob.stopWork(0, JobState.Killed);
                } else {
                    const parsedBody: {result: string, timestamp: number} = JSON.parse(body);
                    thisJob.debug(`parsedBody for: ${resultUrl} : ${JSON.stringify(parsedBody)}`);
                    if (parsedBody.result) {
                        thisJob.setParsedExecutionResult(parsedBody);
                        if (thisJob.queue.TaskOptions.teamBuildPluginAvailable) {
                            thisJob.stopWork(0, JobState.Downloading);
                        } else {
                            thisJob.stopWork(0, JobState.Done);
                        }
                    } else {
                        // result not updated yet -- keep trying
                        thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
                    }
                }
            }).auth(thisJob.queue.TaskOptions.username, thisJob.queue.TaskOptions.password, true);
        }
    }

    private downloadResults(): void {
        const thisJob: Job = this;
        const downloadUrl: string = Util.addUrlSegment(thisJob.ExecutableUrl, 'team-results/zip');
        tl.debug('downloadResults(), url:' + downloadUrl);

        const downloadRequest = request.get({ url: downloadUrl, strictSSL: thisJob.queue.TaskOptions.strictSSL })
            .auth(thisJob.queue.TaskOptions.username, thisJob.queue.TaskOptions.password, true)
            .on('error', (err) => {
                Util.handleConnectionResetError(err); // something went bad
                thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
            })
            .on('response', (response) => {
                tl.debug('downloadResults(), url:' + downloadUrl + ' , response.statusCode: ' + response.statusCode + ', response.statusMessage: ' + response.statusMessage);
                if (response.statusCode == 404) { // expected if there are no results
                    tl.debug('no results to download');
                    thisJob.stopWork(0, JobState.Done);
                } else if (response.statusCode == 200) { // successfully found results
                    const destinationFolder: string = path.join(thisJob.queue.TaskOptions.saveResultsTo, thisJob.Name + '/');
                    const fileName: string = path.join(destinationFolder, 'team-results.zip');

                    try {
                        // Create the destination folder if it doesn't exist
                        if (!tl.exist(destinationFolder)) {
                            tl.debug('creating results destination folder: ' + destinationFolder);
                            tl.mkdirP(destinationFolder);
                        }

                        tl.debug('downloading results file: ' + fileName);

                        const file: fs.WriteStream = fs.createWriteStream(fileName);
                        downloadRequest.pipe(file)
                            .on('error', (err) => { throw err; })
                            .on('finish', function fileFinished() {
                                tl.debug('successfully downloaded results to: ' + fileName);
                                try {
                                    unzip(fileName, destinationFolder);
                                    thisJob.stopWork(0, JobState.Done);
                                } catch (e) {
                                    tl.warning('unable to extract results file');
                                    tl.debug(e.message);
                                    process.stderr.write(e + os.EOL);
                                    thisJob.stopWork(0, JobState.Done);
                                }
                            });
                    } catch (err) {
                        // don't fail the job if the results can not be downloaded successfully
                        tl.warning('unable to download results to file: ' + fileName + ' for Jenkins Job: ' + thisJob.ExecutableUrl);
                        tl.warning(err.message);
                        process.stderr.write(err + os.EOL);
                        thisJob.stopWork(0, JobState.Done);
                    }
                } else { // an unexepected error with results
                    try {
                        const warningMessage: string = (response.statusCode >= 500) ?
                            'A Jenkins error occurred while retrieving results. Results could not be downloaded.' : // Jenkins server error
                            'Jenkins results could not be downloaded.'; // Any other error
                        tl.warning(warningMessage);
                        const warningStream: any = new Util.StringWritable({ decodeStrings: false });
                        downloadRequest.pipe(warningStream)
                            .on('error', (err) => { throw err; })
                            .on('finish', function finished() {
                                tl.warning(warningStream);
                                thisJob.stopWork(0, JobState.Done);
                            });
                    } catch (err) {
                        // don't fail the job if the results can not be downloaded successfully
                        tl.warning(err.message);
                        process.stderr.write(err + os.EOL);
                        thisJob.stopWork(0, JobState.Done);
                    }
                }
            });
    }

    /**
     * Streams the Jenkins console.
     *
     * JobState = Streaming, transition to Finishing possible.
     */
    private streamConsole(): void {
        const thisJob: Job = this;
        const fullUrl: string = Util.addUrlSegment(thisJob.ExecutableUrl, '/logText/progressiveText/?start=' + thisJob.jobConsoleOffset);
        thisJob.debug('Tracking progress of job URL: ' + fullUrl);
        request.get({ url: fullUrl, strictSSL: thisJob.queue.TaskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
            tl.debug('streamConsole().requestCallback()');
            if (err) {
                if (thisJob.retryNumber >= thisJob.queue.TaskOptions.retryCount) {
                    Util.handleConnectionResetError(err); // something went bad
                    thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
                    return;
                }
                else {
                    thisJob.RetryConnection();
                }
            } else if (httpResponse.statusCode === 404) {
                // got here too fast, stream not yet available, try again in the future
                thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
            } else if (httpResponse.statusCode === 401) {
                    Util.failReturnCode(httpResponse, 'Job progress tracking failed to read job progress');
                    thisJob.queue.TaskOptions.captureConsole = false;
                    thisJob.queue.TaskOptions.capturePipeline = false;
                    thisJob.queue.TaskOptions.shouldFail = true;
                    thisJob.queue.TaskOptions.failureMsg = 'Job progress tracking failed to read job progress';
                    thisJob.stopWork(0, JobState.Finishing);
            } else if (httpResponse.statusCode !== 200) {
                if (thisJob.retryNumber >= thisJob.queue.TaskOptions.retryCount) {
                    Util.failReturnCode(httpResponse, 'Job progress tracking failed to read job progress');
                    thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
                }
                else {
                    thisJob.RetryConnection();
                }
            } else {
                thisJob.consoleLog(body); // redirect Jenkins console to task console
                const xMoreData: string = httpResponse.headers['x-more-data'];
                if (xMoreData && xMoreData == 'true') {
                    const offset: string = httpResponse.headers['x-text-size'];
                    thisJob.jobConsoleOffset = Number.parseInt(offset);
                    thisJob.stopWork(thisJob.queue.TaskOptions.pollIntervalMillis, thisJob.State);
                } else { // no more console, move to Finishing
                    thisJob.stopWork(0, JobState.Finishing);
                }
            }
        }).auth(thisJob.queue.TaskOptions.username, thisJob.queue.TaskOptions.password, true)
        .on('error', (err) => {
            if (thisJob.retryNumber >= thisJob.queue.TaskOptions.retryCount) {
                throw err;
            }
            else {
                thisJob.consoleLog(err); 
            }
        });
    }

    public EnableConsole() {
        const thisJob: Job = this;
        if (thisJob.queue.TaskOptions.captureConsole) {
            if (!this.jobConsoleEnabled) {
                if (this.jobConsole != '') { // flush any queued output
                    console.log(this.jobConsole);
                }
                this.jobConsoleEnabled = true;
            }
        }
    }

    public IsConsoleEnabled() {
        return this.jobConsoleEnabled;
    }

    private consoleLog(message: string) {
        if (this.jobConsoleEnabled) {
            //only log it if the console is enabled.
            console.log(message);
        }
        this.jobConsole += message;
    }

    private debug(message: string) {
        const fullMessage: string = this.toString() + ' debug: ' + message;
        tl.debug(fullMessage);
    }

    private toString() {
        let fullMessage: string = '(' + this.State + ':' + this.Name + ':' + this.ExecutableNumber;
        if (this.Parent != null) {
            fullMessage += ', p:' + this.Parent;
        }
        if (this.Joined != null) {
            fullMessage += ', j:' + this.Joined;
        }
        fullMessage += ')';
        return fullMessage;
    }
}
