import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

function runValidations(validator: () => void, tr) {
    try {
        validator();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        throw error;
    }
}

describe('NodeTool Suite', function () {
    this.timeout(60000);

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

    it('Sets proxy correctly', async () => {
        this.timeout(5000);

        process.env["__proxy__"] = "true";
        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        delete process.env["__proxy__"];

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            assert(tr.stdout.indexOf('Setting secret password') > -1, "Password should be set");
            assert(tr.stdout.indexOf('Setting HTTP_PROXY to http://username:password@url.com/') > -1, "Proxy should be set");
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
});