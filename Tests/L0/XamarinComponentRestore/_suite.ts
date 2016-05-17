/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');

var isWin = /^win/.test(process.platform);

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('XamarinComponentRestore Suite', function() {
    this.timeout(20000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });
    
    it('run XamarinComponentRestore with all default inputs', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        tr.setInput('solution', '**/*.sln');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');

        tr.run()
        .then(() => {
            if(isWin) {
                assert(tr.ran('/XamarinComponentRestore/xpkg/xamarin-component.exe restore -u me@ms.com -p mypass /user/build/fun/project.sln'), 'it should have run xamarin component restore');
            } else {
                assert(tr.ran('/home/bin/mono /XamarinComponentRestore/xpkg/xamarin-component.exe restore -u me@ms.com -p mypass /user/build/fun/project.sln'), 'it should have run xamarin component restore');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinComponentRestore 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run XamarinComponentRestore on multiple projects', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        tr.setInput('solution', '**/Multiple*.sln');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        
        tr.run()
        .then(() => {
            if(isWin) {
                assert(tr.ran('/XamarinComponentRestore/xpkg/xamarin-component.exe restore -u me@ms.com -p mypass /user/build/fun/project.sln'), 'it should have run xamarin component restore');
            } else {
                assert(tr.ran('/home/bin/mono /XamarinComponentRestore/xpkg/xamarin-component.exe restore -u me@ms.com -p mypass /user/build/fun/project.sln'), 'it should have run xamarin component restore');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinComponentRestore 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('Found 3 solutions matching') >= 0, 'did not find all solutions');            
            assert(tr.stdout.indexOf('##vso[task.issue type=warning;]multiple solution matches, using /user/build/fun/project.sln') >= 0, 'did not get correct warning');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run XamarinComponentRestore matching NO projects', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        tr.setInput('solution', '**/NoneMatching*.sln');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinComponentRestore');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]xamarin-component.exe failed with error: No solutions found matching the input: **/NoneMatching*.sln') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run XamarinComponentRestore missing solution', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        //tr.setInput('solution', '**/*.sln');
        tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinComponentRestore');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: solution') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
        
    it('run XamarinComponentRestore missing email', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        tr.setInput('solution', '**/*.sln');
        //tr.setInput('email', 'me@ms.com');
        tr.setInput('password', 'mypass');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinComponentRestore');
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
    
    it('run XamarinComponentRestore missing password', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinComponentRestore', true, true);
        tr.setInput('solution', '**/*.sln');
        tr.setInput('email', 'me@ms.com');
        //tr.setInput('password', 'mypass');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinComponentRestore');
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
    
});
