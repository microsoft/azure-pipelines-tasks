import assert = require('assert');
import path = require('path');
import os = require('os');
import process = require('process');
import fs = require('fs');

import * as ttm from 'vsts-task-lib/mock-test';

describe('JavaToolInstaller L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('should fail when JavaToolInstaller is run with no azure server endpoint', (done) => {
        const testPath: string = path.join(__dirname, 'L0FailsIfNoAzureEndpointSet.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.failed, 'task should have failed');
        done();
    });

    it('should run successfully when fetching JDK files from azure storage', (done) => {
        const testPath: string = path.join(__dirname, 'L0DownloadArtifactsFromAzureStorage.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.succeeded, 'task should have succedded.');
        done();
    });

    it('should fail when JavaToolInstaller is run with to destination folder specified', (done) => {
        const testPath: string = path.join(__dirname, 'L0NoDestinationFolder.js');
        const testRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.failed, 'task should have failed');
        done();
    });
});
