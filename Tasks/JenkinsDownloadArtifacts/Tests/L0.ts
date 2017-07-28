// npm install mocha --save-dev
// typings install dt~mocha --save --global

import assert = require('assert');
import path = require('path');
import os = require('os');
import process = require('process');
import fs = require('fs');

import * as ttm from 'vsts-task-lib/mock-test';

describe('JenkinsDownloadArtifacts L0 Suite', function () {
    this.timeout(20000);

    before((done) => {
        process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
        process.env['ENDPOINT_URL_ID1'] = 'bogusURL';

        done();
    });

    /* tslint:disable:no-empty */
    after(function () { });
    /* tslint:enable:no-empty */

    it('run JenkinsDownloadArtifacts with no server endpoint', (done) => {
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

    it('run JenkinsDownloadArtifacts with no save to', (done) => {
        const tp: string = path.join(__dirname, 'L0NoSaveTo.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stderr.indexOf('Input required: saveTo') !== -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts with no job name', (done) => {
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

});
