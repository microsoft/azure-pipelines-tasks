/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');
var shell = require('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
    process.env['MOCK_NORMALIZE_SLASHES'] = true;
}

var jobName = 'JenkinsQueueJob';

describe(jobName + ' Suite', function () {
    this.timeout(20000); // with timeout of 10000, sometimes the first test fails

    before((done) => {
        // init here
        done();
    });

    after(function () {

    });

    it('check args: no serverEndpoint', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Input required: serverEndpoint') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    it('check args: no jobName', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Input required: jobName') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    it('check args: no captureConsole', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Input required: captureConsole') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    it('check args: no capturePipeline', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Input required: capturePipeline') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    it('check args: no parameterizedJob', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');
        tr.setInput('capturePipeline', 'true');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Input required: parameterizedJob') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    // unable to test parameters becuase they are not parsed until after hitting the server.
    it('check args: bogusURL no parameters', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');
        tr.setInput('capturePipeline', 'true');
        tr.setInput('parameterizedJob', 'false');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)"') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
    it('check args: bogusURL with parameters', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');
        tr.setInput('capturePipeline', 'true');
        tr.setInput('trustSSL', 'false');
        tr.setInput('parameterizedJob', 'true');

        tr.run()
            .then(() => {
                assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)"') != -1, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                console.log(err)
                done(err);
            });
    });
});
