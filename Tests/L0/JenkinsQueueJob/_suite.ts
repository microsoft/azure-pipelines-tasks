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

describe(jobName + ' Suite', function() {
    this.timeout(10000);
    
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
    it('check args: bad parameters, no equals sign', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');
        tr.setInput('capturePipeline', 'true');
        tr.setInput('parameterizedJob', 'true');
        tr.setInput('jobParameters', 'noEqualsSign');

        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Job parameters should be specified as "parameterName=parameterValue" with one name, value pair per line. Invalid parameter line: noEqualsSign') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: bad parameters, no parameter name', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('jobName', 'fooJob');
        tr.setInput('captureConsole', 'true');
        tr.setInput('capturePipeline', 'true');
        tr.setInput('parameterizedJob', 'true');
        tr.setInput('jobParameters', '=paramValueWithoutName');

        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Job parameters should be specified as "parameterName=parameterValue" with one name, value pair per line. Invalid parameter line: =paramValueWithoutName') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });

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
            assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/job/fooJob/build?delay=0sec"') != -1, 'should have written to stderr');
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
        tr.setInput('parameterizedJob', 'true');

        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Error: Invalid URI "bogusURL/job/fooJob/buildWithParameters?delay=0sec"') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
});
