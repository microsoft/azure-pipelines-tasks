// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import Q = require('q');
import request = require('request');

import { Job, JobState } from './job';
import { JobQueue } from './jobqueue';

import util = require('./util');

export class JobSearch {
    private taskUrl: string; // URL for the job definition
    private identifier: string; // identifier of the job this search is for
    private queue: JobQueue;
    private searchingFor: Job[] = [];

    constructor(queue: JobQueue, taskUrl: string, identifier: string) {
        this.queue = queue;
        this.taskUrl = taskUrl;
        this.identifier = identifier;

        this.Initialize().fail((err) => {
            throw err;
        });
    }

    private foundCauses : any[] = []; // all found causes indexed by executableNumber

    public Initialized: boolean = false;
    public ParsedTaskBody: ParsedTaskBody; // the parsed task body of the job definition
    private initialSearchBuildNumber: number = -1; // the intial, most likely build number for child jobs
    private nextSearchBuildNumber: number = -1; // the next build number to check
    private searchDirection: number = -1; // the direction to search, start by searching backwards

    private working: boolean = false;
    private workDelay: number = 0;

    public Initialize(): Q.Promise<void> {
        const defer: Q.Deferred<void> = Q.defer<void>();
        const thisSearch: JobSearch = this;
        if (!thisSearch.Initialized) { //only initialize once
            const apiTaskUrl: string = util.addUrlSegment(thisSearch.taskUrl, '/api/json?tree=downstreamProjects[name,url,color],lastBuild[number]');
            tl.debug('getting job task URL:' + apiTaskUrl);
            request.get({ url: apiTaskUrl, strictSSL: thisSearch.queue.TaskOptions.strictSSL }, function requestCallBack(err, httpResponse, body) {
                if (!thisSearch.Initialized) { // only initialize once
                    if (err) {
                        if (err.code == 'ECONNRESET') {
                            tl.debug(err);
                            // resolve but do not initialize -- a job will trigger this again
                            defer.resolve(null);
                        } else {
                            defer.reject(err);
                        }
                    } else if (httpResponse.statusCode !== 200) {
                        defer.reject(util.getFullErrorMessage(httpResponse, 'Unable to retrieve job: ' + thisSearch.identifier));
                    } else {
                        const parsedBody: any = JSON.parse(body);
                        tl.debug(`parsedBody for: ${apiTaskUrl} : ${JSON.stringify(parsedBody)}`);
                        thisSearch.Initialized = true;
                        thisSearch.ParsedTaskBody = parsedBody;
                        // if this is the first time this job is triggered, there will be no lastBuild information, and we assume the
                        // build number is 1 in this case
                        thisSearch.initialSearchBuildNumber = (thisSearch.ParsedTaskBody.lastBuild) ? thisSearch.ParsedTaskBody.lastBuild.number : 1;
                        thisSearch.nextSearchBuildNumber = thisSearch.initialSearchBuildNumber;
                        thisSearch.searchDirection = -1;  // start searching backwards
                        defer.resolve(null);
                    }
                } else {
                    defer.resolve(null);
                }
            }).auth(thisSearch.queue.TaskOptions.username, thisSearch.queue.TaskOptions.password, true);
        } else { // already initialized
            defer.resolve(null);
        }
        return defer.promise;
    }

    public DoWork(): void {
        if (this.working) { // return if already working
            return;
        } else {
            this.working = true;
            setTimeout(() => {
                this.locateExecution();
            }, this.workDelay);
        }
    }

    private stopWork(delay: number): void {
        this.workDelay = delay;
        this.working = false;
        this.searchingFor = [];
    }

    public searchFor(job: Job): void {
        if (this.working) {
            return;
        } else {
            this.searchingFor.push(job);
        }
    }

    public DetermineMainJob(executableNumber: number, callback): void {
        const thisSearch: JobSearch = this;
        if (!thisSearch.foundCauses[executableNumber]) {
            util.fail('No known exeuction number: ' + executableNumber + ' for job: ' + thisSearch.identifier);
        } else {
            const causes : any = thisSearch.foundCauses[executableNumber];
            const causesThatRan: Job[] = []; // these are all the causes for this executableNumber that are running/ran
            const causesThatMayRun: Job[] = []; // these are the causes for this executableNumber that could run in the future
            const causesThatWontRun: Job[] = []; // these are the causes for this executableNumber that will never run
            for (const i in causes) {
                const job: Job = thisSearch.queue.FindJob(causes[i].upstreamUrl, causes[i].upstreamBuild);
                if (job) { // we know about it
                    if (job.State === JobState.Streaming ||
                        job.State === JobState.Finishing ||
                        job.State === JobState.Downloading ||
                        job.State === JobState.Queued ||
                        job.State === JobState.Done) {
                        causesThatRan.push(job);
                    } else if (job.State === JobState.New || job.State === JobState.Locating) {
                        causesThatMayRun.push(job);
                    } else if (job.State === JobState.Joined || job.State === JobState.Cut) {
                        causesThatWontRun.push(job);
                    } else {
                        util.fail('Illegal state: ' + job);
                    }
                }
            }

            let masterJob: Job = null; // there can be only one
            let potentialMasterJobs: Job[] = []; // the list of all potential jobs that could be master
            for (const i in causesThatRan) {
                const causeThatRan: Job = causesThatRan[i];
                const child: Job = findChild(causeThatRan);
                if (child != null) {
                    if (child.State === JobState.Streaming || child.State === JobState.Finishing || child.State === JobState.Done) {
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

            let secondaryJobs: Job[] = [];
            if (masterJob != null) { // secondaryJobs are only possible once a master is assigned
                secondaryJobs = potentialMasterJobs;
                for (const i in causesThatWontRun) {
                    const causeThatWontRun: Job = causesThatWontRun[i];
                    const child: Job = findChild(causeThatWontRun);
                    if (child != null) {
                        secondaryJobs.push(child);
                    }
                }
            }

            callback(masterJob, secondaryJobs);

            function findChild(parent: Job): Job {
                for (const i in parent.Children) {
                    const child: Job = parent.Children[i];
                    if (thisSearch.identifier === child.Identifier) {
                        return child;
                    }
                }
                return null;
            }
        }
    }

    public ResolveIfKnown(job: Job): boolean {
        const thisSearch: JobSearch = this;
        if (job.State !== JobState.New && job.State !== JobState.Locating) {
            return true; // some other callback found it
        } else if (job.Parent == null) { // root -- move straight to streaming
            job.SetStreaming(job.ExecutableNumber);
            return true;
        } else if (job.Parent.State === JobState.Joined || job.Parent.State === JobState.Cut) {
            job.Cut(); // the parent was joined or cut, so cut the child
            return true;
        } else {
            for (const executableNumber in thisSearch.foundCauses) {
                let resolved: boolean = false;
                thisSearch.DetermineMainJob(parseInt(executableNumber), function (mainJob: Job, secondaryJobs: Job[]) {
                    if (job == mainJob) { // job is the main job -- so make sure it's running
                        job.SetStreaming(parseInt(executableNumber));
                        resolved = true;
                        return;
                    } else {
                        for (const i in secondaryJobs) {
                            if (job == secondaryJobs[i]) { // job is a secondary job, so join it to the main one
                                job.SetJoined(mainJob);
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
    private locateExecution() {
        const thisSearch: JobSearch = this;

        tl.debug('locateExecution()');
        // first see if we already know about everything we are searching for
        let foundAll: boolean = true;
        for (const i in thisSearch.searchingFor) {
            const job: Job = thisSearch.searchingFor[i];
            const found: boolean = thisSearch.ResolveIfKnown(job);
            foundAll = foundAll && found;
        }

        if (foundAll) {
            thisSearch.stopWork(0); // found everything we were looking for
            return;
        } else {
            const url: string  = util.addUrlSegment(thisSearch.taskUrl, thisSearch.nextSearchBuildNumber + '/api/json?tree=actions[causes[shortDescription,upstreamBuild,upstreamProject,upstreamUrl]],timestamp');
            tl.debug('pipeline, locating child execution URL:' + url);
            request.get({ url: url, strictSSL: thisSearch.queue.TaskOptions.strictSSL }, function requestCallback(err, httpResponse, body) {
                tl.debug('locateExecution().requestCallback()');
                if (err) {
                    util.handleConnectionResetError(err); // something went bad
                    thisSearch.stopWork(thisSearch.queue.TaskOptions.pollIntervalMillis);
                    return;
                } else if (httpResponse.statusCode === 404) {
                    // try again in the future
                    thisSearch.stopWork(thisSearch.queue.TaskOptions.pollIntervalMillis);
                } else if (httpResponse.statusCode !== 200) {
                    util.failReturnCode(httpResponse, 'Job pipeline tracking failed to read downstream project');
                } else {
                    const parsedBody: any = JSON.parse(body);
                    tl.debug(`parsedBody for: ${url} : ${JSON.stringify(parsedBody)}`);

                    /**
                     * This is the list of all reasons for this job execution to be running.
                     * Jenkins may 'join' several pipelined jobs so all will be listed here.
                     * e.g. suppose A -> C and B -> C.  If both A & B scheduled C around the same time before C actually started,
                     * Jenkins will join these requests and only run C once.
                     * So, for all jobs being tracked (within this code), one is consisdered the main job (which will be followed), and
                     * all others are considered joined and will not be tracked further.
                     */
                    const findCauses = function(actions) {
                        for (const i in actions) {
                            if (actions[i].causes) {
                                return actions[i].causes;
                            }
                        }

                        return null;
                    };

                    const causes: any = findCauses(parsedBody.actions);
                    thisSearch.foundCauses[thisSearch.nextSearchBuildNumber] = causes;
                    thisSearch.DetermineMainJob(thisSearch.nextSearchBuildNumber, function (mainJob: Job, secondaryJobs: Job[]) {
                        if (mainJob != null) {
                            //found the mainJob, so make sure it's running!
                            mainJob.SetStreaming(thisSearch.nextSearchBuildNumber);
                        }
                    });

                    if (thisSearch.searchDirection < 0) { // currently searching backwards
                        if (thisSearch.nextSearchBuildNumber <= 1 || parsedBody.timestamp < thisSearch.queue.RootJob.ParsedExecutionResult.timestamp) {
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
            }).auth(thisSearch.queue.TaskOptions.username, thisSearch.queue.TaskOptions.password, true);
        }
    }
}

interface Project {
    name: string,
    url: string,
    color: string
}
interface ParsedTaskBody {
    downstreamProjects?: Project[],
    lastBuild?: {
        number: number
    }
}
