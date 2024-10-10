// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Result Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    it('setResult success outputs', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Succeeded, 'success msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Succeeded',
                '##vso[task.complete result=Succeeded;]success msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setResult success with issues outputs', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.SucceededWithIssues, 'warning msg');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: SucceededWithIssues',
                '##vso[task.issue type=warning;source=TaskInternal;]warning msg',
                '##vso[task.complete result=SucceededWithIssues;]warning msg']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setResult succeeded with issues does not create issue with empty message', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.SucceededWithIssues, '');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: SucceededWithIssues',
                '##vso[task.complete result=SucceededWithIssues;]']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setResult failed outputs', function (done) {
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
    it('setResult failed does not create issue with empty message', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setResult(tl.TaskResult.Failed, '');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Failed',
                '##vso[task.complete result=Failed;]']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
    it('setSanitizedResult success outputs', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        tl.setSanitizedResult(tl.TaskResult.Succeeded, 'success msg with secret data');

        var expected = testutil.buildOutput(
            ['##vso[task.debug]task result: Succeeded',
                '##vso[task.complete result=Succeeded;]success msg with ...']);

        var output = stdStream.getContents();

        assert.equal(output, expected);

        done();
    })
});
