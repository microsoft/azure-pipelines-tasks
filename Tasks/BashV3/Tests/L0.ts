import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { BashEnvProcessingTests, EnvProcessingTelemetryTests } from './EnvExpansion';
import { runValidateFileArgsTests } from './L0ValidateFileArgs';

describe('Bash Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 80000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    }

    it('Runs an inline script correctly', async () => {
        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        let tp: string = path.join(__dirname, 'L0Inline.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            assert(tr.stdout.indexOf('my script output') > 0, 'Bash should have correctly run the script');
        }, tr);
    });

    it('Runs a checked in script correctly', async () => {
        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        process.env['AZP_TASK_FF_BASHV3_ENABLE_SECURE_ARGS'] = 'false'
        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing exec bash 'temp/path/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing exec bash 'path/to/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }

            assert(tr.stdout.indexOf('my script output') > 0, 'Bash should have correctly run the script');
        }, tr);
    });

    it('Runs a checked in script correctly when using the old behavior', async () => {
        process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'] = "true";
        process.env['AZP_TASK_FF_BASHV3_ENABLE_SECURE_ARGS'] = 'false'
        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing . 'temp/path/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing . 'path/to/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }

            assert(tr.stdout.indexOf('my script output') > 0, 'Bash should have correctly run the script');
        }, tr);
    });

    it('Adds arguments to the script', async () => {
        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        process.env['AZP_TASK_FF_BASHV3_ENABLE_SECURE_ARGS'] = 'false'
        let tp: string = path.join(__dirname, 'L0Args.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing exec bash 'temp/path/script' myCustomArg to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing exec bash 'path/to/script' myCustomArg to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }

            assert(tr.stdout.indexOf('my script output') > 0, 'Bash should have correctly run the script');
        }, tr);
    });

    it('Reports stderr correctly', async () => {
        let tp: string = path.join(__dirname, 'L0StdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;source=CustomerScript;]myErrorTest') > 0, 'Bash should have correctly written myErrorTest');
            assert(tr.stdout.length > 1000, 'Bash stderr output is not truncated');
        }, tr);
    });

    it('Fails on exit code null', async () => {
        let tp: string = path.join(__dirname, 'L0FailOnExitCodeNull.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed when the script exits with null code');
        }, tr);
    });

    it('BASH_ENV - set environment variable', async () => {
        delete process.env['BASH_ENV'];
        process.env['DISTRIBUTEDTASK_TASKS_NODE_SKIPDEBUGLOGSWHENDEBUGMODEOFF'] = 'false';

        const testPath: string = path.join(__dirname, 'L0SetBashEnv.js');
        const taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        await taskRunner.runAsync();

        runValidations(() => {
            assert(taskRunner.succeeded, 'Bash should have succeeded.');
            assert(taskRunner.stdout.indexOf('The BASH_ENV environment variable was set to ~/.profile') > 0, 'Task should set BASH_ENV to ~/.profile');
        }, taskRunner);
    });

    it('BASH_ENV - override environment variable', async () => {
        process.env['BASH_ENV'] = 'some/custom/path';
        process.env['DISTRIBUTEDTASK_TASKS_NODE_SKIPDEBUGLOGSWHENDEBUGMODEOFF'] = 'false';

        const testPath: string = path.join(__dirname, 'L0SetBashEnv.js');
        const taskRunner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

        await taskRunner.runAsync();

        runValidations(() => {
            assert(taskRunner.succeeded, 'Bash should have succeeded.');
            assert(taskRunner.stdout.indexOf('The BASH_ENV environment variable was set to ~/.profile') > 0, 'Task should override the value of BASH_ENV with ~/.profile');
        }, taskRunner);
    });

    describe('File args env processing tests', () => {
        BashEnvProcessingTests()

        EnvProcessingTelemetryTests()

        runValidateFileArgsTests()
    })
});
