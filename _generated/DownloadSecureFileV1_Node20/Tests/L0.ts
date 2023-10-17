import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadSecureFile Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Defaults: download secure file', function() {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp: string = path.join(__dirname, 'L0SecureFile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.stdOutContained('##vso[task.debug]Mock SecureFileHelpers retry count set to: 8'), 'task should have used default retry count of 8');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Uses input retry count', function() {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp: string = path.join(__dirname, 'L0ValidRetryCount.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.stdOutContained('##vso[task.debug]Mock SecureFileHelpers retry count set to: 7'), 'task should have used the input retry count of 7');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Invalid retry count defaults to 8', function() {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp: string = path.join(__dirname, 'L0InvalidRetryCount.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.stdOutContained('##vso[task.debug]Mock SecureFileHelpers retry count set to: 8'), 'task should have used default retry count of 8');
        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Negative retry count defaults to 8', function() {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp: string = path.join(__dirname, 'L0NegativeRetryCount.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.stdOutContained('##vso[task.debug]Mock SecureFileHelpers retry count set to: 8'), 'task should have used default retry count of 8');
        assert(tr.succeeded, 'task should have succeeded');
    });
});