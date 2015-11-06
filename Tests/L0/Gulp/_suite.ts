/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

describe('Gulp Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('runs a gulpfile with cwd', (done) => {
		this.timeout(500);

		assert(true, 'true is true');
		
		var tr = new trm.TaskRunner('Gulp');
		tr.registerTool('gulp', '/fake/bin/gulp');

		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then((result) => {
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
		this.timeout(500);

		assert(true, 'true is true');
		
		var tr = new trm.TaskRunner('Gulp');

		// don't register gulp - which will return null

		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then((result) => {
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

});
