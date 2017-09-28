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

            assert(tr.stderr.indexOf('Input required: serverEndpoint') !== -1, tr.stderr);
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

    it('Should download commits from single build', (done) => {

        const tp: string = path.join(__dirname, 'L0DownloadCommitsFromSingleBuild.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf("GettingCommitsFromSingleBuild") !== -1, "Failed to fetch commits from single build");
            assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should download commits from build range', (done) => {
        const tp: string = path.join(__dirname, 'L0DownloadCommitsFromBuildRange.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
            assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should download rollback commits', (done) => {

        const tp: string = path.join(__dirname, 'L0RollbackCommitsShouldBeDownloaded.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
            assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('No commits should be downloaded if both the jobId is same', (done) => {
        const tp: string = path.join(__dirname, 'L0NoCommitsShouldBeDownloaded.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') === -1, "Should not try to find the build range");
            assert(tr.stdout.indexOf('changeSet[kind,items[commitId,date,msg,author[fullName]]]') === -1 , "Should not call jenkins api to fetch commits");
            assert(tr.stdout.indexOf('JenkinsNoCommitsToFetch') !== -1, "No commits should be downloaded");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with Artifact Provider not as Azure Storage', (done) => {
        const tp: string = path.join(__dirname, 'L0UnkownArtifactProvider.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stderr.indexOf('loc_mock_ArtifactProviderNotSupported') !== -1, tr.stderr);
            assert(tr.failed, 'task should have failed');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with no azure server endpoint', (done) => {
        const tp: string = path.join(__dirname, 'L0NoAzureEndpointFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stderr.indexOf('Input required: ConnectedServiceNameARM') !== -1, tr.stderr);
            assert(tr.failed, 'task should have failed');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts should run successfully', (done) => {
        const tp: string = path.join(__dirname, 'L0DownloadArtifactsFromAzureStorage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stdout.indexOf('loc_mock_ArtifactSuccessfullyDownloaded') !== -1, tr.stdout);
            assert(tr.succeeded, 'task should have succedded.');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });
});
