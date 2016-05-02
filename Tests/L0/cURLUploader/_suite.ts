/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
var shell = require('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('cURLUploader Suite', function() {
    this.timeout(10000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });

    it('runs a curl with single file', (done) => {
        setResponseFile('curlGoodSingleFile.json');
        
        var tr = new trm.TaskRunner('cURLUploader');

        tr.setInput('files', '/some/path/one');
        tr.setInput('username', 'user');
        tr.setInput('password', 'pass');
        tr.setInput('url', 'ftp://some.ftp.com/');
        tr.setInput('redirectStderr', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 1, 'should have only run curl');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })  

    var assertFailedReqInputResponse = (done, tr, input) => {
        assert(tr.resultWasSet, 'task should have set a result');
        assert(tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained('Input required: ' + input));
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running curl');
        done();
    }
    
    it('fails if url (req) input not set', (done) => {
        setResponseFile('curlGoodSingleFile.json');
        
        var tr = new trm.TaskRunner('cURLUploader');
        tr.setInput('files', '/some/path/one');
        //don't set url - required
        //tr.setInput('url', 'ftp://some.ftp.com/');

        tr.run()
        .then(() => {
            assertFailedReqInputResponse(done, tr, 'url');
        })
        .fail((err) => {
            done(err);
        });
    })

    it('fails if files (req) input not set', (done) => {
        setResponseFile('curlGoodSingleFile.json');
        
        var tr = new trm.TaskRunner('cURLUploader');
        //don't set url - required
        //tr.setInput('files', '/some/path/one');
        tr.setInput('url', 'ftp://some.ftp.com/');

        tr.run()
        .then(() => {
            assertFailedReqInputResponse(done, tr, 'files');
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run curl with multiple files', (done) => {
        setResponseFile('curlGoodMultiFiles.json');
        
        var tr = new trm.TaskRunner('cURLUploader');

        tr.setInput('files', '/some/path/some*pattern');
        tr.setInput('username', 'user');
        tr.setInput('password', 'pass');
        tr.setInput('url', 'ftp://some.ftp.com/');
        tr.setInput('redirectStderr', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 1, 'should have only run curl');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
});
