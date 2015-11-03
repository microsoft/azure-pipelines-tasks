/// <reference path="../definitions/mocha.d.ts"/>
/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('./lib/taskRunner');

describe('iOS Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('succeeds', (done) => {
		this.timeout(500);

		assert(true, 'true is true');
		
		var completed = false;
		var taskRunner = new trm.TaskRunner();
		taskRunner.on('completed', (step) => {
			completed = true;
		});

		taskRunner.run()
		.then((result) => {
			assert(completed, 'completed');
			assert(true, 'baselines match');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})		
	it('fails', (done) => {
		this.timeout(500);

		assert(true, 'true is true');
		
		var completed = false;
		var taskRunner = new trm.TaskRunner();
		taskRunner.on('completed', (step) => {
			completed = true;
		});

		taskRunner.run()
		.then((result) => {
			assert(completed, 'completed');
			assert(false, 'baselines do not match');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
});
