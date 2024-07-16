import * as assert from 'assert';
import * as path from 'path';

import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

import { getPlatform, Platform } from '../taskutil';

describe('CondaEnvironment L0 Suite', function () {
    this.timeout(20000);
    describe('conda.ts', function () {
        require('./L0_conda');
    });

    describe('conda_internal.ts', function () {
        require('./L0_conda_internal');
    });

    it('succeeds when creating and activating an environment', function(done) {
        this.timeout(4000);
        const testFile = path.join(__dirname, 'L0CreateEnvironment.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        if (getPlatform() === Platform.Windows) {
            assert(testRunner.ran('conda create --quiet --prefix \\userprofile\\.conda\\envs\\test --mkdir --yes'));
        } else {
            assert(testRunner.ran('conda create --quiet --prefix /home/.conda/envs/test --mkdir --yes'));
        }

        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
        done();
    });

    it('succeeds when using the `base` environment', function(done) {
        const testFile = path.join(__dirname, 'L0BaseEnvironment.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        if (getPlatform() === Platform.Windows) {
            assert(testRunner.ran('conda install python=3 --quiet --yes --json'));
        } else {
            assert(testRunner.ran('sudo /miniconda/bin/conda install python=3 --quiet --yes --json'));
        }

        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
        done();
    });

    it('fails when a Conda installation is not found', function(done) {
        const testFile = path.join(__dirname, 'L0CondaNotFound.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert(testRunner.createdErrorIssue('loc_mock_CondaNotFound'));
        assert(testRunner.failed, 'task should have failed');
        done();
    });
});
