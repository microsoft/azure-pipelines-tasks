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

describe('XamarinTestCloud Suite', function() {
    this.timeout(20000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });

    it('run XamarinTestCloud with all default inputs', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        //tr.setInput('dsym', ''); // iOS only
        //tr.setInput('userDefinedLocale', ''); // shown when locale = user
        //tr.setInput('optionalArgs', '');
        //tr.setInput('publishNUnitResults', ''); // boolean

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('run XamarinTestCloud with optional arguments', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        //tr.setInput('dsym', ''); // iOS only
        //tr.setInput('userDefinedLocale', ''); // shown when locale = user
        tr.setInput('optionalArgs', '--test-param screencapture:true');
        //tr.setInput('publishNUnitResults', ''); // boolean

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --test-param screencapture:true'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --test-param screencapture:true'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    // check all required inputs
    it('fails when app is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        //tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: app') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when teamApiKey is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        //tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: teamApiKey') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('fails when user is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        //tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: user') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
    
    it('fails when devices is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        //tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: devices') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when series is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        //tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: series') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
    
    it('fails when testDir is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        //tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: testDir') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
        
    it('fails when parallelization is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        //tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: parallelization') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('fails when locale is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        //tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: locale') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    

    it('fails when testCloudLocation is missing', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        //tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('Input required: testCloudLocation') >= 0, 'wrong error message: "' + tr.stderr + '"');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
        
    it('fails when app does not exist', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project2.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]The specified app file does not exist: bin/project2.apk') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })    
        
    it('runs when app pattern matches 1', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', '**/*Single.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('runs when app pattern matches muliple', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', '**/*Multiple.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin2/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin3/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin2/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin3/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 3, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when app pattern matches 0', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', '**/*None.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]No matching app files were found with search pattern: **/*None.apk') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })           
    
    it('fails when testDir does not exist', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin2');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]The test assembly directory does not exist: tests/bin2') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when testCloudLocation does not end in test-cloud.exe', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/test-fails-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]test-cloud.exe location must end with \'/test-cloud.exe\'') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('runs when testcloudlocation does not have a pattern', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '/home/build/packages/project1/tools/test-cloud.exe');

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when testCloudLocation does not exist', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '/doesntexist/test-cloud.exe');
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]test-cloud.exe does not exist at the specified location: /doesntexist/test-cloud.exe') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
        
    it('runs when testCloudLocation matches 2', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/matches/2/test-cloud.exe');

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('fails when testCloudLocation matches 0', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/doesntexist/test-cloud.exe');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinTestCloud');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]test-cloud.exe could not be found with search pattern **/doesntexist/test-cloud.exe') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    //TODO build.buildId has a value    
    //TODO build.buildId has a space
    
    it('runs when dsym is set (but no .ipa files)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('dsym', '**/bin/*.dsym'); // iOS only

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('runs when dsym matches 1', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.ipa');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('dsym', '**/bin/*Single.dsym'); // iOS only

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --dsym /bin/project1.dsym'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --dsym /bin/project1.dsym'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
    
    it('runs when dsym matches 2 (with warning)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.ipa');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('dsym', '**/bin/*Multiple.dsym'); // iOS only

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('##vso[task.issue type=warning;]More than one matching dSYM file was found with pattern: **/bin/*Multiple.dsym') >= 0, 'wrong error message');

            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('runs when dsym matches 0 (with warning)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.ipa');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('dsym', '**/bin/*None.dsym'); // iOS only

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('##vso[task.issue type=warning;]No matching dSYM files were found with pattern: **/bin/*None.dsym') >= 0, 'wrong error message');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
          
    it('runs when dsym is not a pattern', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.ipa');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('dsym', '/bin/NoPattern.dsym'); // iOS only

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.ipa key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf('##vso[task.issue type=warning;]No matching dSYM files were found with pattern: /bin/NoPattern.dsym') >= 0, 'wrong error message');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('runs XamarinTestCloud when publishNUnitResults is true', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        // optional inputs
        tr.setInput('publishNUnitResults', 'true'); // boolean

        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --nunit-xml tests/bin/xamarintest_undefined.0.xml'),
                          'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin --nunit-xml tests/bin/xamarintest_undefined.0.xml'),
                          'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('fails when return code is non-zero', (done) => {
        setResponseFile('response.json');
        
        var tr = new trm.TaskRunner('XamarinTestCloud', true, true);
        // required inputs
        tr.setInput('app', 'bin/FAIL/project.apk');
        tr.setInput('teamApiKey', 'key1');
        tr.setInput('user', 'me@ms.com');
        tr.setInput('devices', 'devices1');
        tr.setInput('series', 'master');
        tr.setInput('testDir', 'tests/bin');
        tr.setInput('parallelization', 'none');
        tr.setInput('locale', 'en_US');
        tr.setInput('testCloudLocation', '**/packages/**/tools/test-cloud.exe');
        
        tr.run()
        .then(() => {
            if (isWin) {
                assert(tr.ran('/home/build/packages/project1/tools/test-cloud.exe submit bin/FAIL/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            } else {
                assert(tr.ran('/home/bin/mono /home/build/packages/project1/tools/test-cloud.exe submit bin/FAIL/project.apk key1 --user me@ms.com --devices devices1 --series master --locale en_US --assembly-dir tests/bin'), 'it should have run xamarinTestCloud');
            }
            assert(tr.invokedToolCount == 1, 'should have only run XamarinTestCloud 1 time');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('FAILED') >= 0, 'wrong error message');            
            done();
        })
        .fail((err) => {
            done(err);
        });
    })
});
