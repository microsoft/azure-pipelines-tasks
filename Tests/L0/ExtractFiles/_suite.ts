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

    var responseFiles = ['extractFilesWin.json', 'extractFilesLinux.json'];
    
    responseFiles.forEach((responseFile) => {
        var isWin = responseFile == 'extractFilesWin.json'; 
        var os = isWin ? 'Windows' : 'Linux';
        //simplest case; one file, with default for cleanDestinationFolder
        it(os + ' extracts foo.zip', (done) => {
            setResponseFile(responseFile);
            
            var tr = new trm.TaskRunner('ExtractFiles', true, true);
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
                    assert((tr.stdout.indexOf('extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
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
        it(os + ' extracts foo.tar & subdir/foo.zip', (done) => {
            setResponseFile(responseFile);
            
            var tr = new trm.TaskRunner('ExtractFiles', true, true);
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
                    assert((tr.stdout.indexOf('extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
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
        it(os + ' extracts foo.tar.gz', (done) => {
            setResponseFile(responseFile);
            
            var tr = new trm.TaskRunner('ExtractFiles', true, true);
            tr.setInput('archiveFilePatterns', 'foo.tar.gz');
            tr.setInput('destinationFolder', 'output');
            tr.setInput('cleanDestinationFolder', 'true');
            
            tr.run()
            .then(() => {
                assert(tr.invokedToolCount == (isWin ? 2 : 1), 'should have extracted '+(isWin ? 2 : 1)+' files(s)');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
        })  

        // tests muliple minimatch patterns
        it(os + ' extracts *.zip, *.tar, *.jar, *.7z', (done) => {
            setResponseFile(responseFile);
            
            var tr = new trm.TaskRunner('ExtractFiles', true, true);
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
                    assert((tr.stdout.indexOf('extracted '+shouldExtract[i]) != -1), 'should have extracted '+shouldExtract[i]);
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
});
