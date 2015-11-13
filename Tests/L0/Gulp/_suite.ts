/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');

var ps = shell.which('powershell');
console.log(ps);

describe('Gulp Suite', function() {
    this.timeout(10000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('runs a gulpfile with cwd', (done) => {
		assert(true, 'true is true');
		
		var tr = new trm.TaskRunner('Gulp');
		tr.registerTool('gulp', '/fake/bin/gulp');

		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
			//assert(tr.cwd === '/fake/wd');
			console.log(tr.invokedToolCount);
            assert(tr.ran('/fake/bin/gulp gulpfile.js'), 'it should have run gulp');
            assert(tr.invokedToolCount == 1, 'should have only run gulp');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('errors if gulp not found', (done) => {
		assert(true, 'true is true');
		
		var tr = new trm.TaskRunner('Gulp');

		// don't register gulp - which will return null

		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Required tool not found: gulp';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should not have run gulp');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})

	if (ps) {
		it('passes helper arguments', (done) => {
			psm.runPS(path.join(__dirname, 'Gulptask.PassesHelperArguments.ps1'), done);
		})

		it('formats arguments', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.Arguments.ps1'), done);
		})

		it('formats arguments with targets', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.ArgumentsWithTargets.ps1'), done);
		})

		it('gets gulp command from path', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.GulpCommand.ps1'), done);
		})

		it('falls back to gulp command from node bin path', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.GulpCommandFromNodeBinPath.ps1'), done);
		})

		it('falls back to gulp command from sources directory', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.GulpCommandFromSourcesDirectory.ps1'), done);
		})

		it('throws if gulp not found', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.GulpCommandNotFound.ps1'), done);
		})

		it('sets the working directory', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.WorkingDirectory.ps1'), done);
		})

		it('gets the default working directory', (done) => {
			psm.runPS(path.join(__dirname, 'Helpers.WorkingDirectoryNotSet.ps1'), done);
		})
	}

});