/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/shelljs.d.ts"/>

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');

// node js modules
var request = require('request');


import job = require('./job');
import Job = job.Job;
import JobState = job.JobState;
import jobqueue = require('./jobqueue');
import JobQueue = jobqueue.JobQueue;

import util = require('./util');

export class JobSearch {
    taskUrl: string; // URL for the job definition
    name: string; // name of the job this search is for
    queue: JobQueue;
    searchingFor: Job[] = [];

    constructor(queue: JobQueue, taskUrl: string, name: string) {
        this.queue = queue;
        this.taskUrl = taskUrl;
        this.name = name;

        this.initialize().fail((err) => {
            throw err;
        });
    }

    foundCauses : any[] = []; // all found causes indexed by executableNumber

    initialized: boolean = false;
    parsedTaskBody: any; // the parsed task body of the job definition
    initialSearchBuildNumber: number = -1; // the intial, most likely build number for child jobs
    nextSearchBuildNumber: number = -1; // the next build number to check
    searchDirection: number = -1; // the direction to search, start by searching backwards

    working: boolean = false;
    workDelay: number = 0;

    initialize(): Q.Promise<void> {
        var defer: Q.Deferred<void> = Q.defer<void>();
        var thisSearch : JobSearch = this;
        if (!thisSearch.initialized) { //only initialize once
            var apiTaskUrl : string = util.addUrlSegment(thisSearch.taskUrl, "/api/json");
            tl.debug('getting job task URL:' + apiTaskUrl);
            request.get({ url: apiTaskUrl }, function requestCallBack(err, httpResponse, body) {
                if (!thisSearch.initialized) { // only initialize once
                    if (err) {
                        if (err.code == 'ECONNRESET') {
                            tl.debug(err);
                            // resolve but do not initialize -- a job will trigger this again
                            defer.resolve(null);
                        } else {
                            defer.reject(err);
                        }
                    } else if (httpResponse.statusCode != 200) {
                        defer.reject(util.getFullErrorMessage(httpResponse, 'Unable to retrieve job: ' + thisSearch.name));
                    } else {
                        var parsedBody: any = JSON.parse(body);
                        tl.debug("parsedBody for: " + apiTaskUrl + ": " + JSON.stringify(parsedBody));
                        thisSearch.initialized = true;
                        thisSearch.parsedTaskBody = parsedBody;
                        thisSearch.initialSearchBuildNumber = parsedBody.lastBuild.number;
                        thisSearch.nextSearchBuildNumber = thisSearch.initialSearchBuildNumber;
                        thisSearch.searchDirection = -1;  // start searching backwards
                        defer.resolve(null);
                    }
                } else {
                    defer.resolve(null);
                }
            }).auth(thisSearch.queue.taskOptions.username, thisSearch.queue.taskOptions.password, true);
        } else { // already initialized
            defer.resolve(null);
        }
        return defer.promise;
    }

    doWork() {
        if (this.working) { // return if already working
            return;
        } else {
            this.working = true;
            setTimeout(() => {
                this.locateExecution();
            }, this.workDelay);
        }
    }

    stopWork(delay: number) {
        this.workDelay = delay;
        this.working = false;
        this.searchingFor = [];
    }

    searchFor(job: Job): void {
        if (this.working) {
            return;
        } else {
            this.searchingFor.push(job);
        }
    }

    determineMainJob(executableNumber: number, callback) {
        var thisSearch: JobSearch = this;
        if (!thisSearch.foundCauses[executableNumber]) {
            util.fail('No known exeuction number: ' + executableNumber + ' for job: ' + thisSearch.name);
        } else {
            var causes : any = thisSearch.foundCauses[executableNumber];
            var causesThatRan: Job[] = []; // these are all the causes for this executableNumber that are running/ran
            var causesThatMayRun: Job[] = []; // these are the causes for this executableNumber that could run in the future
            var causesThatWontRun: Job[] = []; // these are the causes for this executableNumber that will never run
            for (var i in causes) {
                var job = thisSearch.queue.findJob(causes[i].upstreamProject, causes[i].upstreamBuild);
                if (job) { // we know about it
                    if (job.state == JobState.Streaming || job.state == JobState.Finishing || job.state == JobState.Done) {
                        causesThatRan.push(job);
                    } else if (job.state == JobState.New || job.state == JobState.Locating) {
                        causesThatMayRun.push(job);
                    } else if (job.state == JobState.Joined || job.state == JobState.Cut) {
                        causesThatWontRun.push(job);
                    } else {
                        util.fail('Illegal state: ' + job);
                    }
                }
            }

            var masterJob: Job = null; // there can be only one
            var potentialMasterJobs: Job[] = []; // the list of all potential jobs that could be master
            for (var i in causesThatRan) {
                var causeThatRan: Job = causesThatRan[i];
                var child : Job = findChild(causeThatRan);
                if (child != null) {
                    if (child.state == JobState.Streaming || child.state == JobState.Finishing || child.state == JobState.Done) {
                        if (masterJob == null) {
                            masterJob = child;
                        } else {
                            util.fail('Can not have more than one master: ' + child);
                        }
                    } else {
                        potentialMasterJobs.push(child);
                    }
                }
            }

            if (masterJob == null && potentialMasterJobs.length > 0) {
                masterJob = potentialMasterJobs[0]; // simply assign the first one to master
                potentialMasterJobs = potentialMasterJobs.slice(1); // and remove it from here
            }

            var secondaryJobs: Job[] = [];
            if (masterJob != null) { // secondaryJobs are only possible once a master is assigned
                secondaryJobs = potentialMasterJobs;
                for (var i in causesThatWontRun) {
                    var causeThatWontRun : Job = causesThatWontRun[i];
                    var child : Job = findChild(causeThatWontRun);
                    if (child != null) {
                        secondaryJobs.push(child);
                    }
                }
            }

            callback(masterJob, secondaryJobs);

            function findChild(parent: Job): Job {
                for (var i in parent.children) {
                    var child: Job = parent.children[i];
                    if (thisSearch.name == child.name) {
                        return child
                    }
                }
                return null;
            }
        }
    }

    resolveIfKnown(job: Job): boolean {
        var thisSearch: JobSearch = this;
        if (job.state != JobState.New && job.state != JobState.Locating) {
            return true; // some other callback found it
        } else if (job.parent == null) { // root -- move straight to streaming
            job.setStreaming(job.executableNumber);
            return true;
        } else if (job.parent.state == JobState.Joined || job.parent.state == JobState.Cut) {
            job.cut(); // the parent was joined or cut, so cut the child
            return true;
        } else {
            for (var executableNumber in thisSearch.foundCauses) {
                var resolved : boolean = false;
                thisSearch.determineMainJob(parseInt(executableNumber), function (mainJob: Job, secondaryJobs: Job[]) {
                    if (job == mainJob) { // job is the main job -- so make sure it's running
                        job.setStreaming(parseInt(executableNumber));
                        resolved = true;
                        return;
                    } else {
                        for (var i in secondaryJobs) {
                            if (job == secondaryJobs[i]) { // job is a secondary job, so join it to the main one
                                job.setJoined(mainJob);
                                resolved = true;
                                return;
                            }
                        }
                    }
                });
                if (resolved) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Search for a pipelined job starting with a best guess for the build number, and a direction to search.
     * First the search is done backwards and terminates when either finding the specified job, or the job's
     * timestamp is earlier than the timestamp of the parent job that queued it.  Then the restarts from the
     * intial start point and searches forward until the job is found, or a 404 is reached and no more jobs
     * are queued.  At any point, the search also ends if the job is joined to another job.
     */
    locateExecution() {
        var thisSearch: JobSearch = this;

        tl.debug('locateExecution()');
        // first see if we already know about everything we are searching for
        var foundAll: boolean = true;
        for (var i in thisSearch.searchingFor) {
            var job: Job = thisSearch.searchingFor[i];
            var found: boolean = thisSearch.resolveIfKnown(job);
            foundAll = foundAll && found;
        }

        if (foundAll) {
            thisSearch.stopWork(0); // found everything we were looking for
            return;
        } else {
            var url : string  = util.addUrlSegment(thisSearch.taskUrl, thisSearch.nextSearchBuildNumber + "/api/json");
            tl.debug('pipeline, locating child execution URL:' + url);
            request.get({ url: url }, function requestCallback(err, httpResponse, body) {
                tl.debug('locateExecution().requestCallback()');
                if (err) {
                    util.handleConnectionResetError(err); // something went bad
                    thisSearch.stopWork(thisSearch.queue.taskOptions.pollIntervalMillis);
                    return;
                } else if (httpResponse.statusCode == 404) {
                    // try again in the future
                    thisSearch.stopWork(thisSearch.queue.taskOptions.pollIntervalMillis);
                } else if (httpResponse.statusCode != 200) {
                    util.failReturnCode(httpResponse, 'Job pipeline tracking failed to read downstream project');
                } else {
                    var parsedBody: any = JSON.parse(body);
                    tl.debug("parsedBody for: " + url + ": " + JSON.stringify(parsedBody));

                    /**
                     * This is the list of all reasons for this job execution to be running.  
                     * Jenkins may 'join' several pipelined jobs so all will be listed here.
                     * e.g. suppose A -> C and B -> C.  If both A & B scheduled C around the same time before C actually started, 
                     * Jenkins will join these requests and only run C once.
                     * So, for all jobs being tracked (within this code), one is consisdered the main job (which will be followed), and
                     * all others are considered joined and will not be tracked further.
                     */
                    var causes : any = parsedBody.actions[0].causes;
                    thisSearch.foundCauses[thisSearch.nextSearchBuildNumber] = causes;
                    thisSearch.determineMainJob(thisSearch.nextSearchBuildNumber, function (mainJob: Job, secondaryJobs: Job[]) {
                        if (mainJob != null) {
                            //found the mainJob, so make sure it's running!
                            mainJob.setStreaming(thisSearch.nextSearchBuildNumber);
                        }
                    });

                    if (thisSearch.searchDirection < 0) { // currently searching backwards
                        if (thisSearch.nextSearchBuildNumber <= 1 || parsedBody.timestamp < thisSearch.queue.rootJob.parsedExecutionResult.timestamp) {
                            //either found the very first job, or one that was triggered before the root job was; need to change search directions
                            thisSearch.searchDirection = 1;
                            thisSearch.nextSearchBuildNumber = thisSearch.initialSearchBuildNumber + 1;
                        } else {
                            thisSearch.nextSearchBuildNumber--;
                        }
                    } else {
                        thisSearch.nextSearchBuildNumber++;
                    }
                    return thisSearch.stopWork(0); // immediately poll again because there might be more jobs
                }
            }).auth(thisSearch.queue.taskOptions.username, thisSearch.queue.taskOptions.password, true);
        }
    }
}
