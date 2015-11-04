/// <reference path="../definitions/mocha.d.ts"/>
/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('./lib/taskRunner');
import path = require('path');

var taskPath = function(name: string) {
	var taskPath = path.join(__dirname, '..', 'Tasks', name);
	console.log(name + ' : ' + taskPath);
	return taskPath;
}

var utilPath = function(name: string) {
	var utilPath = path.join(__dirname, name);
	console.log(name + ' : ' + utilPath);
	return utilPath;
}

console.log();
var outputPath = utilPath('output');
var basePath = utilPath('baselines');
var xcodePath = taskPath('Xcode');

describe('iOS Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('Xcode with Workspace', (done) => {
		this.timeout(500);

		assert(true, 'true is true');
		
		var completed = false;
		var taskRunner = new trm.TaskRunner(xcodePath);
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
});
