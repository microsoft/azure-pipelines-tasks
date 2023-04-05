// npm install mocha --save-dev
// typings install dt~mocha --save --global

import assert = require('assert');
import path = require('path');
import process = require('process');
import {JobState, checkStateTransitions} from '../states';

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('JenkinsQueueJob L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
        process.env['ENDPOINT_URL_ID1'] = 'bogusURL';
        //Environment variables must have _ in place of .
        process.env['Build_StagingDirectory'] = 'someBuild_StagingDirectory';

        done();
    });

    /* tslint:disable:no-empty */
    after(function () { });
    /* tslint:enable:no-empty */

    it('run JenkinsQueueJob with no server endpoint', (done) => {
        const tp: string = path.join(__dirname, 'L0NoServerEndpoint.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: serverEndpoint') !== -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();

            //assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            //assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            //assert(tr.stderr.length === 0, 'should not have written to stderr');
            //assert(tr.succeeded, 'task should have succeeded');
            //assert(tr.stdout.indexOf('GRADLE_OPTS is now set to -Xmx2048m') > 0);
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with no job name', (done) => {
        const tp: string = path.join(__dirname, 'L0NoJobName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: jobName') !== -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with no capture console', (done) => {
        const tp: string = path.join(__dirname, 'L0NoCaptureConsole.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: captureConsole') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with no capture pipeline', (done) => {
        const tp: string = path.join(__dirname, 'L0NoCapturePipeline.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: capturePipeline') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with no parameterized job', (done) => {
        const tp: string = path.join(__dirname, 'L0NoParameterizedJob.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: parameterizedJob') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with bogus url no parameters', (done) => {
        const tp: string = path.join(__dirname, 'L0BogusUrlNoParameters.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)"') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsQueueJob with bogus url with parameters', (done) => {
        const tp: string = path.join(__dirname, 'L0BogusUrlParameters.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)"') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('[Job state] Run the longest test scenario of the state transitions', (done) => {
        let currentState: JobState = JobState.New;

        // the longest scenario from possible
        const expectedScenario: Array<JobState> = [
            JobState.Locating,
            JobState.Streaming,
            JobState.Finishing,
            JobState.Downloading,
            JobState.Done
        ];

        const executedScenario: Array<JobState> = [];

        for (const newState of expectedScenario) {
            const isValidTransition: boolean = checkStateTransitions(currentState, newState);
            if (isValidTransition) {
                executedScenario.push(newState);
                currentState = newState;
            } else {
                console.log(`Invalid state transition from: ${JobState[currentState]} to: ${JobState[newState]}`);
                break;
            }
        }

        assert.deepEqual(expectedScenario, executedScenario);
        done();
    });

    it('[Job state] Check that transition rules are defined for all states', (done) => {
        try {
            const stateList = Object.keys(JobState).filter((element) => isNaN(Number(element)));

            for (const testedState of stateList) {
                for (const state of stateList) {
                    checkStateTransitions(JobState[testedState], JobState[state]);
                }
            }
            done();
        } catch (error) {
            done(error);
        }
    });
});
