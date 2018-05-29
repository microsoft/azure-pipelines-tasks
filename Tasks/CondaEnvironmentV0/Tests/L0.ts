import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';

import { MockTestRunner } from 'vsts-task-lib/mock-test';

describe('CondaEnvironment L0 Suite', function () {
    describe('conda.ts', function () {
        require('./L0_conda');
    });

    describe('conda_internal.ts', function () {
        require('./L0_conda_internal');
    });

    it('succeeds when creating and activating an environment', function () {
        const testFile = path.join(__dirname, 'L0CreateEnvironment.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert(testRunner.ran(`conda create --quiet --prefix ${path.join('/', 'miniconda', 'envs', 'test')} --mkdir --yes`));
        assert.strictEqual(testRunner.stderr.length, 0, 'should not have written to stderr');
        assert(testRunner.succeeded, 'task should have succeeded');
    });

    // TODO 1263674 There seems to be an issue on the official build
    // where the test really finds Conda on the build machine
    // Fix and re-enable
    xit('fails when a Conda installation is not found', function () {
        const testFile = path.join(__dirname, 'L0CondaNotFound.js');
        const testRunner = new MockTestRunner(testFile);

        testRunner.run();

        assert(testRunner.createdErrorIssue('loc_mock_CondaNotFound'));
        assert(testRunner.failed, 'task should have failed');
    });
});
