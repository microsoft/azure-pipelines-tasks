import assert = require('assert');
import path = require('path');
import os = require('os');
import process = require('process');
import fs = require('fs');

import * as ttm from 'vsts-task-lib/mock-test';

describe('JavaToolInstaller L0 Suite', function () {
    this.timeout(20000);

    it('should fail when JavaToolInstaller is run with no azure server endpoint', (done) => {
        const testPath: string = path.join(__dirname, 'L0NoAzureEndpointFailure.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        try{
            testRunner.run();

            assert(testRunner.stderr.indexOf('Input required: ConnectedServiceNameARM') !== -1, testRunner.stderr);
            assert(testRunner.failed, 'task should have failed');
            done();
        }
        catch(err) {
            console.log(testRunner.stdout);
            console.log(testRunner.stderr);
            console.log(err);
            done(err);
        }
    });

    it('should run successfully when fetching JDK files from azure storage', (done) => {
        const testPath: string = path.join(__dirname, 'L0DownloadArtifactsFromAzureStorage.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        try{
            testRunner.run();

            assert(testRunner.stdout.indexOf('loc_mock_ArtifactSuccessfullyDownloaded') !== -1, testRunner.stdout);
            assert(testRunner.succeeded, 'task should have succedded.');
            done();
        }
        catch(err) {
            console.log(testRunner.stdout);
            console.log(testRunner.stderr);
            console.log(err);
            done(err);
        }
    });

    it('should fail when JavaToolInstaller is run with to destination folder specified', (done) => {
        const testPath: string = path.join(__dirname, 'L0NoDestinationFolder.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        try {
            testRunner.run();

            assert(testRunner.stderr.indexOf('Input required: destinationFolder') !== -1, 'should have written to stderr');
            assert(testRunner.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(testRunner.stdout);
            console.log(testRunner.stderr);
            console.log(err);
            done(err);
        }
    });

    it('cleans destination folder if specified', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(__dirname, 'L0cleansIfSpecified.js');
        let testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);
        testRunner.run();

        assert(
            testRunner.succeeded,
            'should have succeeded');
        assert(
            testRunner.stdOutContained(`rmRF ${path.normalize('/destDir/clean-subDir')}`),
            'should have cleaned destDir/clean-subDir');
        assert(
            testRunner.stdOutContained(`rmRF ${path.normalize('/destDir/clean-file.txt')}`),
            'should have cleaned destDir/clean-file.txt');
        done();
    });
});
