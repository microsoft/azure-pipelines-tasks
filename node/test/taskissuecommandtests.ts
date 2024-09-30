// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as testutil from './testutil';
import * as tl from '../_build/task';
import { IssueAuditAction, IssueSource, _loadData } from '../_build/internal';


describe('Task Issue command test without correlation ID', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });

    after(function (done) {
        done();
    });

    it('adds issue sources for task.issue messages', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error", IssueSource.CustomerScript)
        tl.warning("Test warning", IssueSource.TaskInternal)

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=CustomerScript;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for task.issue command', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error");
        tl.warning("Test warning");

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=TaskInternal;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for the setResult', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, 'failed msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
             '##vso[task.issue type=error;source=TaskInternal;]failed msg',
             '##vso[task.complete result=Failed;]failed msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});

describe('Task Issue command test with correlation ID', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        process.env['COMMAND_CORRELATION_ID'] = 'test_id123';
        _loadData();
        done();
    });

    after(function (done) {
        delete process.env['COMMAND_CORRELATION_ID'];
        _loadData();
        done();
    });

    it('removes the correlation ID from env var', function (done) {
        this.timeout(1000);

        assert.equal(process.env['COMMAND_CORRELATION_ID'], undefined);

        done();
    })

    it('doesn\'t provide the correlation ID using task variables', function (done) {
        this.timeout(1000);

        process.env['AGENT_VERSION'] = '2.115.0'
        let variable = tl.getVariable('COMMAND_CORRELATION_ID');
        let taskVariable = tl.getTaskVariable('COMMAND_CORRELATION_ID');
        assert.equal(variable, undefined);
        assert.equal(taskVariable, undefined);
        
        done();
    })

    it('adds the correlation ID for task.issue messages', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error", IssueSource.CustomerScript)
        tl.warning("Test warning", IssueSource.TaskInternal)

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=CustomerScript;correlationId=test_id123;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;correlationId=test_id123;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for task.issue command', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.error("Test error");
        tl.warning("Test warning");

        var expected = testutil.buildOutput(
            ['##vso[task.issue type=error;source=TaskInternal;correlationId=test_id123;]Test error',
             '##vso[task.issue type=warning;source=TaskInternal;correlationId=test_id123;]Test warning']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })

    it('adds the default "TaskInternal" source for the setResult', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, 'failed msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
             '##vso[task.issue type=error;source=TaskInternal;correlationId=test_id123;]failed msg',
             '##vso[task.complete result=Failed;]failed msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});

describe('Task Issue command, audit action tests', function () {
    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }

        done();
    });

    after(function (done) {
        done();
    });

    it('Audit action is present in issue', function (done) {
        this.timeout(1000);

        const stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        const expected = testutil.buildOutput(
            ['##vso[task.issue type=error;auditAction=1;]Test error',
                '##vso[task.issue type=warning;auditAction=1;]Test warning']);

        tl.error("Test error", null, IssueAuditAction.ShellTasksValidation);
        tl.warning("Test warning", null, IssueAuditAction.ShellTasksValidation);

        const output = stdStream.getContents();

        assert.strictEqual(output, expected);
        done();
    })

    it('Audit action not present if unspecified', function (done) {
        this.timeout(1000);

        const stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        const expected = testutil.buildOutput(
            ['##vso[task.issue type=error;]Test error',
                '##vso[task.issue type=warning;]Test warning']);

        tl.error("Test error", null);
        tl.warning("Test warning", null);

        const output = stdStream.getContents();

        assert.strictEqual(output, expected);
        done();
    })

    it('Audit action is present when value is not from enum', function (done) {
        this.timeout(1000);

        const stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        const expected = testutil.buildOutput(
            ['##vso[task.issue type=error;auditAction=123;]Test error',
                '##vso[task.issue type=warning;auditAction=321;]Test warning']);

        tl.error("Test error", null, 123 as IssueAuditAction);
        tl.warning("Test warning", null, 321 as IssueAuditAction);

        const output = stdStream.getContents();

        assert.strictEqual(output, expected);
        done();
    })
});
