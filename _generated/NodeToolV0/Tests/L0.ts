import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NodeTool Suite', function () {
    this.timeout(60000);

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

    it('Succeeds when the first download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr);
    });

    it('Succeeds when the second download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SecondDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr);
    });

    it('Succeeds when the third download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ThirdDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr);
    });

    it('Removes "v" prefixes when evaluating latest version', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0GetsLatestVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr);
    });

    it('Read node version from file', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ReadVersionFromFileSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr);
    });
});