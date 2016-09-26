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

var jobName = 'JenkinsDownloadArtifacts';

describe(jobName + ' Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

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
        tr.setInput('saveTo', 'tmp/');

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
    it('check args: no saveTo', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');

        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: saveTo') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
});
