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
		
		var taskRunner = new trm.TaskRunner('Gulp');
		taskRunner.setInput('gulpFile', 'gulpfile.js');
		taskRunner.setInput('cwd', 'fake/wd');
		taskRunner.run()
		.then((result) => {
			assert(true, 'baselines match');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
});
