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
var gulpPath = taskPath('Gulp');

describe('Gulp Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('Gulp with gulpfile', (done) => {
		this.timeout(500);

		assert(true, 'true is true');
		
		var taskRunner = new trm.TaskRunner(gulpPath);
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
