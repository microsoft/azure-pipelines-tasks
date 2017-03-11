/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('XamariniOS Suite', function() {
    this.timeout(20000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });
    
    it('run XamariniOS with all default inputs', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '');
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
            assert(tr.ran('/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run xbuild');
            assert(tr.invokedToolCount == 2, 'should have only run 2 commands');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run XamariniOS with mdtoolLocation set', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '/home/bin2/');
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
            assert(tr.ran('/home/bin2/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run xbuild');
            assert(tr.invokedToolCount == 2, 'should have only run 2 commands');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
    
    it('fails when solution is a pattern', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', '**/*.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '');
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found solution: **/*.sln') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
    
    it('fails when solution is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', ''); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '');
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: solution') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })     
    
    it('fails when solution is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', '');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '');
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: configuration') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
         
    it('fails when xbuildLocation not provided and xbuild is not found', (done) => {
        setResponseFile('responseNoToolsFound.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '');
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found xbuild: null') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when xbuildLocation is provided but is incorrect', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '/user/bin/');
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found xbuild: /user/bin/xbuild') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    // fails when nuget not found
    it('fails when nuget not found', (done) => {
        setResponseFile('responseNoToolsFound.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('mdtoolLocation', '/home/bin2');
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('unlockDefaultKeychain', ''); //boolean
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('p12', ''); //path
        tr.setInput('p12pwd', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('provProfile', ''); //path
        tr.setInput('removeProfile', ''); //boolean
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found nuget: null') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
});