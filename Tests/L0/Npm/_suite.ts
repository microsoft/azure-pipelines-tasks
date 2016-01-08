/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Npm Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('run Npm in cwd', (done) => {
		setResponseFile('npmGood.json');
		
		var tr = new trm.TaskRunner('Npm');
		tr.setInput('command', 'install');
		tr.setInput('arguments', 'npm');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/npm install npm'), 'it should have run Npm');
            assert(tr.invokedToolCount == 1, 'should have only run Npm');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stdout.length > 0, 'should have written to stdout');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('fails if Npm fails', (done) => {
		setResponseFile('npmFails.json');
		
		var tr = new trm.TaskRunner('Npm');
		tr.setInput('command', 'install');
		tr.setInput('arguments', 'npm -g');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/npm install npm -g'), 'it should have run Npm');
            assert(tr.invokedToolCount == 1, 'should have only run Npm');

			var expectedErr = '/usr/local/bin/npm failed with return code: 1';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if cwd not set', (done) => {
		setResponseFile('npmGood.json');
		
		var tr = new trm.TaskRunner('Npm');
		tr.setInput('command', 'install');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: cwd'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running npm');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if command not set', (done) => {
		setResponseFile('npmGood.json');
		
		var tr = new trm.TaskRunner('Npm');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: command'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running npm');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});