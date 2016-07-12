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

var jobName = 'FTPUpload';

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
    it('check args: no rootFolder', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: rootFolder') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: no clean', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: clean') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: no overwrite', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        tr.setInput('clean', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: overwrite') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: no preservePaths', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        tr.setInput('clean', 'true');
        tr.setInput('overwrite', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: preservePaths') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: no remotePath', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        tr.setInput('clean', 'true');
        tr.setInput('overwrite', 'true');
        tr.setInput('preservePaths', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: remotePath') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: no filePatterns', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        tr.setInput('clean', 'true');
        tr.setInput('overwrite', 'true');
        tr.setInput('preservePaths', 'true');
        tr.setInput('remotePath', '/upload/');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Input required: filePatterns') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });
    it('check args: bogusURL', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner(jobName, true);
        tr.setInput('serverEndpoint', 'ID1');
        tr.setInput('rootFolder', 'rootFolder');
        tr.setInput('clean', 'true');
        tr.setInput('overwrite', 'true');
        tr.setInput('preservePaths', 'true');
        tr.setInput('remotePath', '/upload/');
        tr.setInput('filePatterns', '*');
        
        tr.run()
        .then(() => {
            assert(tr.stderr.indexOf('Unhandled:Cannot read property \'toLowerCase\' of null') != -1, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            console.log(err)
            done(err);
        });
    });

});
