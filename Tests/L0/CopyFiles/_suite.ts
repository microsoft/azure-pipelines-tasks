/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import os = require('os');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Copy Files Suite', function() {
    this.timeout(10000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});	
	
	it('copy all files from srcdir to destdir', (done) => {
		setResponseFile('copyFilesAllGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
		tr.setInput('Contents', '**');
		tr.setInput('SourceFolder', '/srcDir');
		tr.setInput('TargetFolder', '/destDir');
		tr.setInput('CleanTargetFolder', 'false');
		tr.setInput('OverWrite', 'false');		
		tr.run()
		.then(() => {
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			assert(tr.stdout.match(/###copying###/gi).length === 5, 'should copy files.');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
	
	it('copy some files from srcdir to destdir', (done) => {
		setResponseFile('copyFilesSomeGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
        var patterns = '**' + os.EOL + path.join('!**', 'someOtherDir2', '**');

		tr.setInput('Contents', patterns);
		tr.setInput('SourceFolder', '/srcDir');
		tr.setInput('TargetFolder', '/destDir');
		tr.setInput('CleanTargetFolder', 'false');
		tr.setInput('OverWrite', 'false');		
		tr.run()
		.then(() => {
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			assert(tr.stdout.match(/###copying###/gi).length === 2, 'should copy files.');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if Contents not set', (done) => {
		setResponseFile('copyFilesAllGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
		tr.setInput('SourceFolder', '/srcDir');
		tr.setInput('TargetFolder', '/destDir');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: Contents'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running CopyFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if SourceFolder not set', (done) => {
		setResponseFile('copyFilesAllGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
		tr.setInput('Contents', '**');
		tr.setInput('TargetFolder', '/destDir');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: SourceFolder'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running CopyFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if TargetFolder not set', (done) => {
		setResponseFile('copyFilesAllGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
		tr.setInput('Contents', '**');
		tr.setInput('SourceFolder', '/srcDir');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: TargetFolder'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running CopyFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if SourceFolder not found', (done) => {
		setResponseFile('copyFilesAllGood.json');
		
		var tr = new trm.TaskRunner('CopyFiles');
		tr.setInput('Contents', '**');
		tr.setInput('SourceFolder', '/notExistDir');
		tr.setInput('TargetFolder', '/destDir');
		tr.run()
		.then(() => {
			assert(tr.failed, 'should have failed');
            var expectedErr = 'not found SourceFolder';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running CopyFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});