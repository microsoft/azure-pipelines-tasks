import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('CUrlUploaderV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('runs a curl with single file', async () => {
        const tp = path.join(__dirname, 'L0CurlGoodSingleFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have only run curl');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('fails if url (req) input not set', async () => {
        const tp = path.join(__dirname, 'L0NoUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: url'), 'Should have printed: Input required: url');
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running curl');
    });

    it('fails if files (req) input not set', async () => {
        const tp = path.join(__dirname, 'L0NoFiles.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: files'), 'Should have printed: Input required: files');
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running curl');
    });

    it('run curl with multiple files', async () => {
        const tp = path.join(__dirname, 'L0CurlGoodMultiFiles.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have only run curl');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
    });
});
