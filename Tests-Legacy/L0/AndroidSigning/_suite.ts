/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import fs = require('fs');
var shell = require('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}
        
describe('AndroidSigning Suite', function() {
    this.timeout(10000);

    before((done) => {
        // init here         
        done();
    });
    
    after(() => {
       
    })

    it('Do not sign or zipalign if nothing is selected', (done) => {
        setResponseFile('androidSignAlignSingleFile.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/fake.apk');
        tr.setInput('jarsign', 'false');
        tr.setInput('zipalign', 'false');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not run anything');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })  
    
    it ('Do not align or sign if input single file does not exist', (done) => {
        setResponseFile('androidSignAlignNoFileInput.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/path/nonexistent.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not run anything');
            assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })
    
    it ('Do not align or sign if input pattern does not match any files', (done) => {
        setResponseFile('androidSignAlignNoFileInput.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/nonexistent/path/*.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not run anything');
            assert(tr.stderr.length > 0, 'should have failed to match files');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })
    

    it ('Use jarsigner from PATH before searching in JAVA_HOME', (done) => {
        setResponseFile('androidSignAlignEnvNotSet.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/path/a.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('keystoreFile', '/some/store'); 
        tr.setInput('keystorePass', 'pass1');
        tr.setInput('keystoreAlias', 'somealias');
        tr.setInput('keyPass', 'pass2');
        tr.setInput('zipalign', 'false');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 1, 'should have run jarsigner');
            assert(tr.stderr.length == 0, 'should have jarsigned file');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })
    
    it ('Fail if jarsigner is not on PATH and JAVA_HOME is not set', (done) => {
        setResponseFile('androidSignAlignEnvNotSet.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/path/a.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not run anything');
            assert(tr.stderr.length > 0, 'should have failed to locate jarsigner');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })
    
    it ('Fail if ANDROID_HOME is not set', (done) => {
        setResponseFile('androidSignAlignEnvNotSet.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/path/a.apk');
        tr.setInput('jarsign', 'false');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 0, 'should not run anything');
            assert(tr.stderr.length > 0, 'should have jarsigned file');
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    })

    it('Signing a single file', (done) => {
        setResponseFile('androidSignAlignSingleFile.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/fake.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('keystoreFile', '/some/store'); 
        tr.setInput('keystorePass', 'pass1');
        tr.setInput('keystoreAlias', 'somealias');
        tr.setInput('keyPass', 'pass2');
        tr.setInput('zipalign', 'false');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 1, 'should run jarsigner');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    }) 
    
    it('zipalign a single file', (done) => {
        setResponseFile('androidSignAlignSingleFile.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/fake.apk');
        tr.setInput('jarsign', 'false');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 1, 'should run zipalign');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    }) 
    
    it('Signing and aligning multiple file', (done) => {
        setResponseFile('androidSignAlignMultipleFile.json');
        
        var tr = new trm.TaskRunner('AndroidSigning', true);
        
        tr.setInput('files', '/some/path/*.apk');
        tr.setInput('jarsign', 'true');
        tr.setInput('keystoreFile', '/some/store'); 
        tr.setInput('keystorePass', 'pass1');
        tr.setInput('keystoreAlias', 'somealias');
        tr.setInput('keyPass', 'pass2');
        tr.setInput('zipalign', 'true');
        
        tr.run()
        .then(() => {
            assert(tr.invokedToolCount == 4, 'should have run jarsigner and zipalign twice each');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        }); 
    }) 
});
