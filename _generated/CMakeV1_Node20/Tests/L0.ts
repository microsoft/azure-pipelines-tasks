import assert = require('assert');
import path = require('path');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('CMake Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('run cmake in cwd', async () => {
        const testPath = path.join(__dirname, 'L0RunInCwd.js');
        const runner: MockTestRunner = new MockTestRunner(testPath);

        await runner.runAsync();

        assert(runner.ran('/usr/local/bin/cmake ..'), 'it should have run cmake');
        assert(runner.invokedToolCount == 1, 'should have only run cmake');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
    })

    it('fails if cmake fails', async () => {
        const testPath = path.join(__dirname, 'L0ShouldFail.js');
        const runner: MockTestRunner = new MockTestRunner(testPath);

        await runner.runAsync();

        assert(runner.ran('/usr/local/bin/cmake ..'), 'it should have run cmake');
        assert.strictEqual(runner.invokedToolCount, 1, 'should have only run cmake');

        const expectedErr: string = '/usr/local/bin/cmake failed with return code: 50';
        assert(runner.stdOutContained(expectedErr), 'should have printed: ' + expectedErr);
        assert(runner.failed, 'task should have failed');
    })

    it('errors if cwd not set', async () => {
        const testPath = path.join(__dirname, 'L0NoCwdSet.js');
        const runner: MockTestRunner = new MockTestRunner(testPath);

        await runner.runAsync();

        assert(runner.failed, 'should have failed');
        const expectedErr = 'Input required: cwd';
        assert(runner.stdOutContained(expectedErr), 'should have said: ' + expectedErr);
        assert.strictEqual(runner.invokedToolCount, 0, 'should exit before running CMake');
    })
});
