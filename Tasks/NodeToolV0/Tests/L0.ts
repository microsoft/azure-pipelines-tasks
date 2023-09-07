import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NodeTool Suite', function () {
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

    it('Succeeds when the first download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Succeeds when the second download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SecondDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr, done);
    });

    it('Succeeds when the third download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ThirdDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr, done);
    });

    it('Removes "v" prefixes when evaluating latest version', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0GetsLatestVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Read node version from file', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ReadVersionFromFileSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });


});