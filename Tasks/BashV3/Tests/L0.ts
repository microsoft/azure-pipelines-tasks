import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('Bash Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    it('Runs an inline script correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        let tp: string = path.join(__dirname, 'L0Inline.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            assert(tr.stdout.indexOf('my script output') > 0,'Bash should have correctly run the script');
        }, tr, done);
    });

    it('Runs a checked in script correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing exec bash 'temp/path/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing exec bash 'path/to/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }
            
            assert(tr.stdout.indexOf('my script output') > 0,'Bash should have correctly run the script');
        }, tr, done);
    });

    it('Runs a checked in script correctly when using the old behavior', (done: Mocha.Done) => {
        this.timeout(5000);

        process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'] = "true";
        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing . 'temp/path/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing . 'path/to/script' to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }
            
            assert(tr.stdout.indexOf('my script output') > 0,'Bash should have correctly run the script');
        }, tr, done);
    });

    it('Adds arguments to the script', (done: Mocha.Done) => {
        this.timeout(5000);

        delete process.env['AZP_BASHV3_OLD_SOURCE_BEHAVIOR'];
        let tp: string = path.join(__dirname, 'L0Args.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Bash should have succeeded.');
            assert(tr.stderr.length === 0, 'Bash should not have written to stderr');
            if (process.platform === 'win32') {
                // This is different on windows because we change the script name to make sure the normalization call is happening.
                assert(tr.stdout.indexOf(`Writing exec bash 'temp/path/script' myCustomArg to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            } else {
                assert(tr.stdout.indexOf(`Writing exec bash 'path/to/script' myCustomArg to temp/path/fileName.sh`) > 0, 'Bash should have written the script to a file');
            }
            
            assert(tr.stdout.indexOf('my script output') > 0,'Bash should have correctly run the script');
        }, tr, done);
        console.log(tr.stdout);
    });

    it('Reports stderr correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0StdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]myErrorTest') > 0, 'Bash should have correctly written myErrorTest');
            assert(tr.stdout.length > 1000, 'Bash stderr output is not truncated');
        }, tr, done);
    });

    it('Fails on exit code null', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailOnExitCodeNull.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed when the script exits with null code');
        }, tr, done);
    });
});