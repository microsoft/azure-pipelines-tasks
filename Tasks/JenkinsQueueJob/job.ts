
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import url = require('url');
import shell = require('shelljs');

// node js modules
var request = require('request');

import jobsearch = require('./jobsearch');
import JobSearch = jobsearch.JobSearch;
import jobqueue = require('./jobqueue');
import JobQueue = jobqueue.JobQueue;

import unzip = require('./unzip');

import * as Util from './util';

// Jobs transition between states as follows:
// ------------------------------------------
// BEGINNING STATE: New
// New →            Locating, Streaming, Joined, Cut
// Locating →       Streaming, Joined, Cut
// Streaming →      Finishing
// Finishing →      Downloading, Queued, Done
// Downloading →    Done
// TERMINAL STATES: Done, Queued, Joined, Cut
export enum JobState {
    New,       // 0 - The job is yet to begin
    Locating,  // 1 - The job is being located
    Streaming, // 2 - The job is running and its console output is streaming
    Finishing, // 3 - The job has run and is "finishing"
    Done,      // 4 - The job has run and is done
    Joined,    // 5 - The job is considered complete because it has been joined to the execution of another matching job execution
    Queued,    // 6 - The job was queued and will not be tracked for completion (as specified by the "Capture..." task setting)
    Cut,       // 7 - The job was cut from execution by the pipeline
    Downloading// 8 - The job has run and its results are being downloaded (occurs when the TFS Plugin for Jenkins is installed)
}

export class Job {
    parent: Job; // if this job is a pipelined job, its parent that started it.
    children: Job[] = []; // any pipelined jobs
    joined: Job; // if this job is joined, the main job that is running
    search: JobSearch;
    queue: JobQueue;

    taskUrl: string; // URL for the job definition

    state: JobState = JobState.New;
    executableUrl: string; // URL for the executing job instance
    executableNumber: number;
    name: string;
    identifier: string; // a job identifier that takes into account folder structure
    jobConsole: string = "";
    jobConsoleOffset: number = 0;
    jobConsoleEnabled: boolean = false;

    working: boolean = true; // initially mark it as working
    workDelay: number = 0;

    parsedExecutionResult: any; // set during state Finishing

    constructor(jobQueue: JobQueue, parent: Job, taskUrl: string, executableUrl: string, executableNumber: number, name: string) {
        this.parent = parent;
        this.taskUrl = taskUrl;
        this.executableUrl = executableUrl;
        this.executableNumber = executableNumber;
        this.name = name;
        if (this.parent != null) {
            this.parent.children.push(this);
        }
        this.queue = jobQueue;

        if (this.taskUrl.startsWith(this.queue.taskOptions.serverEndpointUrl)) {
            // simplest case (jobs run on the same server name as the endpoint)
            this.identifier = this.taskUrl.substr(this.queue.taskOptions.serverEndpointUrl.length);
        } else {
            // backup check in case job is running on a different server name than the endpoint
            this.identifier = url.parse(this.taskUrl).path.substr(1);
            var jobStringIndex: number = this.identifier.indexOf('job/');
            if (jobStringIndex > 0) {
                // can fall into here if the jenkins endpoint is not at the server root; e.g. serverUrl/jenkins instead of serverUrl
                this.identifier = this.identifier.substr(jobStringIndex);
            }
        }
        this.queue.addJob(this);

        this.debug('created');
        this.initialize();
    }

    /**
     * All changes to the job state should be routed through here.
     * This defines all and validates all state transitions.
     */
    changeState(newState: JobState) {
        var oldState: JobState = this.state;
        this.state = newState;
        if (oldState != newState) {
            this.debug('state changed from: ' + oldState);
            var validStateChange: boolean = false;
            if (oldState == JobState.New) {
                validStateChange = (newState == JobState.Locating || newState == JobState.Streaming || newState == JobState.Joined || newState == JobState.Cut);
            } else if (oldState == JobState.Locating) {
                validStateChange = (newState == JobState.Streaming || newState == JobState.Joined || newState == JobState.Cut);
            } else if (oldState == JobState.Streaming) {
                validStateChange = (newState == JobState.Finishing);
            } else if (oldState == JobState.Finishing) {
                validStateChange = (newState == JobState.Downloading || newState == JobState.Queued || newState == JobState.Done);
            } else if (oldState == JobState.Downloading) {
                validStateChange = (newState == JobState.Done);
            } else if (oldState == JobState.Done || oldState == JobState.Joined || oldState == JobState.Cut) {
                validStateChange = false; // these are terminal states
            }
            if (!validStateChange) {
                Util.fail('Invalid state change from: ' + oldState + ' ' + this);
            }
        }
    }

    doWork() {
        if (this.working) { // return if already working
            return;
        } else {
            this.working = true;
            setTimeout(() => {
                if (this.state == JobState.New) {
                    this.initialize();
                } else if (this.state == JobState.Streaming) {
                    this.streamConsole();
                } else if (this.state == JobState.Downloading) {
                    this.downloadResults();
                } else if (this.state == JobState.Finishing) {
                    this.finish();
                } else {
                    // usually do not get here, but this can happen if another callback caused this job to be joined
                    this.stopWork(this.queue.taskOptions.pollIntervalMillis, null);
                }
            }, this.workDelay);
        }
    }

    stopWork(delay: number, jobState: JobState) {
        if (jobState && jobState != this.state) {
            this.changeState(jobState);
            if (!this.isActive()) {
                this.queue.flushJobConsolesSafely();
            }
        }
        this.workDelay = delay;
        this.working = false;
    }

    isActive(): boolean {
        return this.state == JobState.New ||
            this.state == JobState.Locating ||
            this.state == JobState.Streaming ||
            this.state == JobState.Downloading ||
            this.state == JobState.Finishing
    }

    getBlockMessage(message: string): string {
        var divider: string = '******************************************************************************';
        var blockMessage: string = divider + '\n' + message + ' \n' + divider;
        return blockMessage;
    }

    setStreaming(executableNumber: number): void {
        if (this.state == JobState.New || this.state == JobState.Locating) {
            this.executableNumber = executableNumber;
            this.executableUrl = Util.addUrlSegment(this.taskUrl, this.executableNumber.toString());
            this.changeState(JobState.Streaming);
            // log the jobs starting block
            this.consoleLog(this.getBlockMessage('Jenkins job started: ' + this.name + '\n' + this.executableUrl));
            // log any pending jobs
            if (this.queue.findActiveConsoleJob() == null) {
                console.log('Jenkins job pending: ' + this.executableUrl);
            }
        } else if (this.state == JobState.Joined || this.state == JobState.Cut) {
            Util.fail('Can not be set to streaming: ' + this);
        }
        this.joinOthersToMe();
    }

    joinOthersToMe() {
        //join all other siblings to this same job (as long as it's not root)
        var thisJob: Job = this;
        if (thisJob.parent != null) {
            thisJob.search.determineMainJob(thisJob.executableNumber, function (mainJob: Job, secondaryJobs: Job[]) {
                if (mainJob != thisJob) {
                    Util.fail('Illegal call in joinOthersToMe(), job:' + thisJob);
                }
                for (var i in secondaryJobs) {
                    var secondaryJob: Job = secondaryJobs[i];
                    if (secondaryJob.state != JobState.Cut) {
                        secondaryJob.setJoined(thisJob);
                    }
                }
            });
        }
    }

    setJoined(joinedJob: Job): void {
        tl.debug(this + '.setJoined(' + joinedJob + ')');
        this.joined = joinedJob;
        this.changeState(JobState.Joined);
        if (joinedJob.state == JobState.Joined || joinedJob.state == JobState.Cut) {
            Util.fail('Invalid join: ' + this);
        }

        // recursively cut all children
        for (var i in this.children) {
            this.children[i].cut();
        }
    }

    cut(): void {
        this.changeState(JobState.Cut);
        for (var i in this.children) {
            this.children[i].cut();
        }
    }

    setParsedExecutionResult(parsedExecutionResult) {
        this.parsedExecutionResult = parsedExecutionResult;
        //log the job's closing block
        this.consoleLog(this.getBlockMessage('Jenkins job finished: ' + this.name + '\n' + this.executableUrl));
    }

    getTaskResult(): number {
        if (this.state == JobState.Queued) {
            return tl.TaskResult.Succeeded;
        } else if (this.state == JobState.Done) {
            var resultCode = this.parsedExecutionResult.result.toUpperCase();
            if (resultCode == "SUCCESS" || resultCode == 'UNSTABLE') {
                return tl.TaskResult.Succeeded;
            } else {
                return tl.TaskResult.Failed;
            }
        }
        return tl.TaskResult.Failed;
    }

    getResultString(): string {
        if (this.state == JobState.Queued) {
            return 'Queued';
        } else if (this.state == JobState.Done) {
            var resultCode: string = this.parsedExecutionResult.result.toUpperCase();
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
        } else return tl.loc('unknown');
    }

    initialize() {
        var thisJob: Job = this;
        thisJob.search.initialize().then(() => {
            if (thisJob.search.initialized) {
                if (thisJob.queue.taskOptions.capturePipeline) {
                    var downstreamProjects = thisJob.search.parsedTaskBody.downstreamProjects || [];
                    downstreamProjects.forEach((project) => {
                        new Job(thisJob.queue, thisJob, project.url, null, -1, project.name); // will add a new child to the tree
                    });
                }
                thisJob.search.resolveIfKnown(thisJob); // could change state
                var newState: JobState = (thisJob.state == JobState.New) ? JobState.Locating : thisJob.state; // another call back could also change state
                var nextWorkDelay: number = (newState == JobState.Locating) ? thisJob.queue.taskOptions.pollIntervalMillis : thisJob.workDelay;
                thisJob.stopWork(nextWorkDelay, newState);
            } else {
                //search not initialized, so try again
                thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
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
    finish(): void {
        var thisJob: Job = this;
        tl.debug('finish()');
        if (!thisJob.queue.taskOptions.captureConsole) { // transition to Queued
            thisJob.stopWork(0, JobState.Queued);
        } else { // stay in Finishing, or eventually go to Done
            var resultUrl: string = Util.addUrlSegment(thisJob.executableUrl, 'api/json');
            thisJob.debug('Tracking completion status of job: ' + resultUrl);
            request.get({ url: resultUrl, strictSSL: thisJob.queue.taskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
                tl.debug('finish().requestCallback()');
                if (err) {
                    Util.handleConnectionResetError(err); // something went bad
                    thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
                    return;
                } else if (httpResponse.statusCode != 200) {
                    Util.failReturnCode(httpResponse, 'Job progress tracking failed to read job result');
                } else {
                    var parsedBody: any = JSON.parse(body);
                    thisJob.debug("parsedBody for: " + resultUrl + ": " + JSON.stringify(parsedBody));
                    if (parsedBody.result) {
                        thisJob.setParsedExecutionResult(parsedBody);
                        if (thisJob.queue.taskOptions.teamBuildPluginAvailable) {
                            thisJob.stopWork(0, JobState.Downloading);
                        } else {
                            thisJob.stopWork(0, JobState.Done);
                        }
                    } else {
                        // result not updated yet -- keep trying
                        thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
                    }
                }
            }).auth(thisJob.queue.taskOptions.username, thisJob.queue.taskOptions.password, true);
        }
    }

    downloadResults(): void {
        var thisJob: Job = this;
        var downloadUrl: string = Util.addUrlSegment(thisJob.executableUrl, 'team-results/zip');
        tl.debug('downloadResults(), url:' + downloadUrl);

        var downloadRequest = request.get({ url: downloadUrl, strictSSL: thisJob.queue.taskOptions.strictSSL })
            .auth(thisJob.queue.taskOptions.username, thisJob.queue.taskOptions.password, true)
            .on("error", err => {
                Util.handleConnectionResetError(err); // something went bad
                thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
            })
            .on("response", response => {
                tl.debug('downloadResults(), url:' + downloadUrl + ' , response.statusCode: ' + response.statusCode + ', response.statusMessage: ' + response.statusMessage);
                if (response.statusCode == 404) { // expected if there are no results
                    tl.debug('no results to download');
                    thisJob.stopWork(0, JobState.Done);
                } else if (response.statusCode == 200) { // successfully found results
                    var destinationFolder: string = path.join(thisJob.queue.taskOptions.saveResultsTo, thisJob.name + '/')
                    var fileName = path.join(destinationFolder, 'team-results.zip');

                    try {
                        // Create the destination folder if it doesn't exist
                        if (!tl.exist(destinationFolder)) {
                            tl.debug('creating results destination folder: ' + destinationFolder);
                            tl.mkdirP(destinationFolder);
                        }

                        tl.debug('downloading results file: ' + fileName);

                        let file = fs.createWriteStream(fileName);
                        downloadRequest.pipe(file)
                            .on("error", err => { throw err; })
                            .on("finish", function fileFinished() {
                                tl.debug('successfully downloaded results to: ' + fileName);
                                try {
                                    unzip.unzip(fileName, destinationFolder);
                                    thisJob.stopWork(0, JobState.Done);
                                } catch (e) {
                                    tl.warning('unable to extract results file')
                                    tl.debug(e.message);
                                    tl._writeError(e);
                                    thisJob.stopWork(0, JobState.Done);
                                }
                            });
                    } catch (e) {
                        // don't fail the job if the results can not be downloaded successfully
                        tl.warning('unable to download results to file: ' + fileName + ' for Jenkins Job: ' + thisJob.executableUrl);
                        tl.warning(e.message);
                        tl._writeError(e);
                        thisJob.stopWork(0, JobState.Done);
                    }
                } else { // an unexepected error with results
                    try {
                        var warningMessage: string = (response.statusCode >= 500) ?
                            'A Jenkins error occurred while retrieving results. Results could not be downloaded.' : // Jenkins server error
                            'Jenkins results could not be downloaded.'; // Any other error
                        tl.warning(warningMessage);
                        var warningStream: any = new Util.StringWritable({ decodeStrings: false });
                        downloadRequest.pipe(warningStream)
                            .on("error", err => { throw err; })
                            .on("finish", function finsished() {
                                tl.warning(warningStream);
                                thisJob.stopWork(0, JobState.Done);
                            });
                    } catch (e) {
                        // don't fail the job if the results can not be downloaded successfully
                        tl.warning(e.message);
                        tl._writeError(e);
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
    streamConsole(): void {
        var thisJob: Job = this;
        var fullUrl: string = Util.addUrlSegment(thisJob.executableUrl, '/logText/progressiveText/?start=' + thisJob.jobConsoleOffset);
        thisJob.debug('Tracking progress of job URL: ' + fullUrl);
        request.get({ url: fullUrl, strictSSL: thisJob.queue.taskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
            tl.debug('streamConsole().requestCallback()');
            if (err) {
                Util.handleConnectionResetError(err); // something went bad
                thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
                return;
            } else if (httpResponse.statusCode == 404) {
                // got here too fast, stream not yet available, try again in the future
                thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
            } else if (httpResponse.statusCode != 200) {
                Util.failReturnCode(httpResponse, 'Job progress tracking failed to read job progress');
            } else {
                thisJob.consoleLog(body); // redirect Jenkins console to task console
                var xMoreData = httpResponse.headers['x-more-data'];
                if (xMoreData && xMoreData == 'true') {
                    var offset = httpResponse.headers['x-text-size'];
                    thisJob.jobConsoleOffset = offset;
                    thisJob.stopWork(thisJob.queue.taskOptions.pollIntervalMillis, thisJob.state);
                } else { // no more console, move to Finishing
                    thisJob.stopWork(0, JobState.Finishing);
                }
            }
        }).auth(thisJob.queue.taskOptions.username, thisJob.queue.taskOptions.password, true);;
    }

    enableConsole() {
        var thisJob: Job = this;
        if (thisJob.queue.taskOptions.captureConsole) {
            if (!this.jobConsoleEnabled) {
                if (this.jobConsole != "") { // flush any queued output
                    console.log(this.jobConsole);
                }
                this.jobConsoleEnabled = true;
            }
        }
    }

    isConsoleEnabled() {
        return this.jobConsoleEnabled;
    }

    consoleLog(message: string) {
        if (this.jobConsoleEnabled) {
            //only log it if the console is enabled.
            console.log(message);
        }
        this.jobConsole += message;
    }

    debug(message: string) {
        var fullMessage: string = this.toString() + ' debug: ' + message;
        tl.debug(fullMessage);
    }

    toString() {
        var fullMessage: string = '(' + this.state + ':' + this.name + ':' + this.executableNumber;
        if (this.parent != null) {
            fullMessage += ', p:' + this.parent;
        }
        if (this.joined != null) {
            fullMessage += ', j:' + this.joined;
        }
        fullMessage += ')';
        return fullMessage;
    }
}