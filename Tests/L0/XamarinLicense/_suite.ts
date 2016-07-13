/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('XamarinLicense Suite', function() {
    this.timeout(20000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });
    
    // Unfortunately, this task is not just a wrapper around an EXE
    // For this reason, we can't really mock what it does to handle all the
    // interesting test cases. Here we test to make sure the inputs are checked
    // and that the we don't fail until the first step of work is attempted 

    it('Activate XamarinLicense with all default inputs', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'Activate');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            if(os.platform() === 'darwin' || os.platform() === 'win32') {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]Failed to login to Xamarin with specified email and password.') >= 0, 'wrong error message');
            } else {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]The xamarin product: ' + 'MA' + ' is not supported on this os: ') >= 0, 'wrong error message');
            }
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
 
    it('Deactivate XamarinLicense with all default inputs', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'Deactivate');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            if(os.platform() === 'darwin' || os.platform() === 'win32') {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]Failed to login to Xamarin with specified email and password.') >= 0, 'wrong error message');
            } else {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]The xamarin product: ' + 'MA' + ' is not supported on this os: ') >= 0, 'wrong error message');
            }
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('Fails for missing action', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        //tr.setInput('action', '');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: action') >= 0, 'wrong error message: "' + tr.stderr + '"');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('Fails for unknown action', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'unknown');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            if(os.platform() === 'darwin' || os.platform() === 'win32') {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]Unknown action: unknown') >= 0, 'wrong error message');
            } else {
                assert(tr.stdout.indexOf('##vso[task.issue type=error;]The xamarin product: ' + 'MA' + ' is not supported on this os: ') >= 0, 'wrong error message');
            }
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('Fails for missing email', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'Activate');
        //tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: email') >= 0, 'wrong error message: "' + tr.stderr + '"');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('Fails for missing password', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'Activate');
        tr.setInput('email', 'me@ms.com');
        //tr.setInput('password', 'mypass');
        tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: password') >= 0, 'wrong error message: "' + tr.stderr + '"');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
    
    it('Fails for missing product', (done) => {
        setResponseFile('responseEmpty.json');
        
        var tr = new trm.TaskRunner('XamarinLicense', true, true);
        tr.setInput('action', 'Activate');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        //tr.setInput('product', 'MA');
        tr.setInput('timeout', '30');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]No product selected to activate.') >= 0, 'wrong error message');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })        
});