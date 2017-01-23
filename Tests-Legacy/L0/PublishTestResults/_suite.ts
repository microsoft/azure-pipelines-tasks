/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import shell = require('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Publish Test Results Suite', function () {
    this.timeout(10000);

    before((done) => {
        // init here
        setResponseFile('publishTestResultResponses.json');
        done();
    });

    after(function () {

    });

    it('Publish test results with resultFiles filter that does not match with any files', (done) => {

        let tr = new trm.TaskRunner('PublishTestResults');

        tr.setInput('testRunner', 'JUnit');
        tr.setInput('testResultsFiles', '/invalid/*pattern');

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish test results with resultFiles filter that matches with some files', (done) => {

        let tr = new trm.TaskRunner('PublishTestResults');
        let pattern = path.join(__dirname, 'data', '*TEST.xml');

        tr.setInput('testRunner', 'JUnit');
        tr.setInput('testResultsFiles', pattern);
        tr.setInput('mergeTestResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;resultFiles=/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish test results with resultFiles as file path', (done) => {

        let tr = new trm.TaskRunner('PublishTestResults');
        let pattern = path.join(__dirname, 'data', 'jUnit1TEST.xml');

        tr.setInput('testRunner', 'JUnit');
        tr.setInput('testResultsFiles', pattern);

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;resultFiles=/) >= 0, 'should publish test results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish test results when test result files input is not provided', (done) => {

        let tr = new trm.TaskRunner('PublishTestResults');
        tr.setInput('testRunner', 'Junit');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: testResultsFiles'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish test results when test runner type input is not provided', (done) => {

        let tr = new trm.TaskRunner('PublishTestResults');
        tr.setInput('testResultsFiles', '/file.xml');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: testRunner'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishTestResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })
});