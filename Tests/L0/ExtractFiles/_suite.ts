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

describe('ExtractFiles Suite', function() {
    this.timeout(10000);
    
    before((done) => {
        // init here
        done();
    });

    after(function() {
        
    });

    var win = os.type().match(/^Win/);
    if(!win){
        //TODO tests only run on windows at the moment.
        return;
    }
    

    //simplest case; one file, with default for cleanDestinationFolder
    it('extracts foo.zip', (done) => {
        setResponseFile('extractFilesGood.json');
        
        var tr = new trm.TaskRunner('ExtractFiles', true);
        tr.setInput('archiveFilePatterns', 'foo.zip');
		tr.setInput('destinationFolder', 'output');
        tr.setInput('cleanDestinationFolder', 'true');
        
        tr.run()
        .then(() => {
            var shouldExtract = [
                "mockedBuildSources/foo.zip",
            ];
            
            assert(tr.invokedToolCount == shouldExtract.length, 'should have extracted '+shouldExtract.length+' files(s)');
            for(var i in shouldExtract){
                assert((tr.stdout.indexOf('7zip extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
            }

            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    });  

    //another simple case, but goes through a different flow, multiple args are passed, and a sub directory is used
    it('extracts foo.tar & subdir/foo.zip', (done) => {
        setResponseFile('extractFilesGood.json');
        
        var tr = new trm.TaskRunner('ExtractFiles', true);
        tr.setInput('archiveFilePatterns', 'foo.tar\nsubdir/foo.zip');
		tr.setInput('destinationFolder', 'output');
        tr.setInput('cleanDestinationFolder', 'true');
        
        tr.run()
        .then(() => {

            var shouldExtract = [
                "mockedBuildSources/foo.tar",
                "mockedBuildSources/subdir/foo.zip"
            ];
            
            assert(tr.invokedToolCount == shouldExtract.length, 'should have extracted '+shouldExtract.length+' files(s)');
            for(var i in shouldExtract){
                assert((tr.stdout.indexOf('7zip extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
            }
            
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    });
    
    //tests the double extraction needed for compressed tars on windows
    it('extracts foo.tar.gz', (done) => {
        setResponseFile('extractFilesGood.json');
        
        var tr = new trm.TaskRunner('ExtractFiles', true);
        tr.setInput('archiveFilePatterns', 'foo.tar.gz');
		tr.setInput('destinationFolder', 'output');
        tr.setInput('cleanDestinationFolder', 'true');
        
        tr.run()
        .then(() => {
            //TODO this is failing because we need to mock out fs.readdirSync() which does not exist on task library yet
            //and therefore fails the task, so check explicitly for that failure (as it is expected until this is mockable)
            //assert(tr.invokedToolCount == 2, 'should have extracted 2 files(s)');
            //assert(tr.stderr.length == 0, 'should not have written to stderr');
            //assert(tr.succeeded, 'task should have succeeded');
            assert(tr.invokedToolCount == 1, 'should have extracted 1 files(s)');
            assert(tr.stderr.startsWith('Unhandled:ENOENT: no such file or directory, scandir'));
            assert(tr.failed, 'task should have failed');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })  

    // tests muliple minimatch patterns
    it('extracts *.zip, *.tar, *.jar, *.7z', (done) => {
        setResponseFile('extractFilesGood.json');
        
        var tr = new trm.TaskRunner('ExtractFiles', true);
        tr.setInput('archiveFilePatterns', '*.zip\n*.tar\n*.jar\n*.7z');
		tr.setInput('destinationFolder', 'output');
        tr.setInput('cleanDestinationFolder', 'true');
        
        tr.run()
        .then(() => {
            var shouldExtract = [
                "mockedBuildSources/foo.zip",
                "mockedBuildSources/subdir/foo.zip",
                "mockedBuildSources/foo.tar",
                "mockedBuildSources/subdir/foo.jar",
                "mockedBuildSources/subdir/subdir/foo.7z"
            ];
            
            assert(tr.invokedToolCount == shouldExtract.length, 'should have extracted '+shouldExtract.length+' files(s)');
            for(var i in shouldExtract){
                assert((tr.stdout.indexOf('7zip extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
            }
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })  
    
});
