import * as assert from 'assert';
import * as path from 'path';

import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('CondaEnvironment L0 Suite', function () {
    describe('conda.ts', function () {
        require('./L0_conda');
    });

    describe('conda_internal.ts', function () {
        require('./L0_conda_internal');
    });

    it('succeeds when creating and activating an environment', async function () {
        this.timeout(10000);
        const testFile = path.join(__dirname, 'L0CreateEnvironment.js');
        const testRunner = new MockTestRunner(testFile);

        await testRunner.runAsync();

        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr: ' + testRunner.stderr);
        assert(testRunner.ran(`conda create --quiet --prefix ${path.join('/', 'miniconda', 'envs', 'test')} --mkdir --yes`), "Did not run 'conda create': " + testRunner.stdout);
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    it('fails when a Conda installation is not found', async function () {
        const testFile = path.join(__dirname, 'L0CondaNotFound.js');
        const testRunner = new MockTestRunner(testFile);

        await testRunner.runAsync();

        assert(testRunner.createdErrorIssue('loc_mock_CondaNotFound'));
        assert(testRunner.failed, 'task should have failed');
    });
});
