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

describe('Publish Code Coverage Results Suite', function() {
    this.timeout(10000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

    });

    it('Publish code coverage results with all input parameters', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('reportDirectory', '/user/admin/report');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\/user\/admin\/report;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results without report directory input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results without additional files input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('reportDirectory', '/user/admin/report');

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\/user\/admin\/report;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when there are no additional files matching the given input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('reportDirectory', '/user/admin/report');
        tr.setInput('additionalCodeCoverageFiles', "/other/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\/user\/admin\/report;additionalcodecoveragefiles=;\]/) >= 0, 'should publish code coverage results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when code coverage tool is not provided', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: codeCoverageTool'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when summaryfile is not provided', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResults');
        tr.setInput('codeCoverageTool', 'JaCoCo');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: summaryFileLocation'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })
});