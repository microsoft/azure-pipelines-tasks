/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('XamariniOS Suite', function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    
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
        tr.setInput('buildToolLocation', '');
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
            assert(tr.ran('/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run msbuild');
            assert(tr.invokedToolCount == 3, 'should have only run 3 commands');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('run XamariniOS with buildToolLocation set', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('buildToolLocation', '/home/bin2/msbuild');
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/nuget restore src/project.sln'), 'it should have run nuget restore');
            assert(tr.ran('/home/bin2/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone'), 'it should have run msbuild');
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
        tr.setInput('buildToolLocation', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
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
        tr.setInput('buildToolLocation', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
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
         
    it('fails when msbuildLocation not provided and msbuild is not found', (done) => {
        setResponseFile('responseNoToolsFound.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('buildToolLocation', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Xamarin.iOS task failed with error MSBuild or xbuild (Mono) were not found on the macOS or Linux agent') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when msbuildLocation is provided but is incorrect', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamariniOS', true, true);
        // Required inputs
        tr.setInput('solution', 'src/project.sln'); //path
        tr.setInput('configuration', 'Release');
        // Optional inputs
        tr.setInput('args', '');
        tr.setInput('packageApp', ''); //boolean
        tr.setInput('forSimulator', ''); //boolean
        tr.setInput('buildToolLocation', '/user/bin/');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamariniOS');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found build tool: /user/bin/') >= 0, 'wrong error message');            
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
        tr.setInput('runNugetRestore', 'true'); //boolean
        tr.setInput('buildToolLocation', '/home/bin2/msbuild');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        
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