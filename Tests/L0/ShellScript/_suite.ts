/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('ShellScript Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('run ShellScript in cwd', (done) => {
		setResponseFile('shellscriptGood.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('scriptPath', '/script.sh');
		tr.setInput('args', 'arg1 arg2');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
            assert(tr.invokedToolCount == 1, 'should have only run ShellScript');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('fails if ShellScript fails', (done) => {
		setResponseFile('shellscriptFails.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('scriptPath', '/script.sh');
		tr.setInput('args', 'arg1 arg2');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
            assert(tr.invokedToolCount == 1, 'should have only run ShellScript');

			var expectedErr = '/usr/local/bin/bash failed with return code: 1';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails ShellScript on stderr fails', (done) => {
		setResponseFile('shellscriptStderrFails.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('scriptPath', '/script.sh');
		tr.setInput('args', 'arg1 arg2');
		tr.setInput('cwd', 'fake/wd');
		tr.setInput('failOnStandardError', 'true');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/bash /script.sh arg1 arg2'), 'it should have run ShellScript');
            assert(tr.invokedToolCount == 1, 'should have only run ShellScript');

			var expectedErr = '/usr/local/bin/bash failed with return code: 0';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if cwd not set', (done) => {
		setResponseFile('shellscriptGood.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('scriptPath', '/script.sh');		
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: cwd'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running ShellScript');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if scriptPath not set', (done) => {
		setResponseFile('shellscriptGood.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('cwd', 'fake/wd');	
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: scriptPath'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running ShellScript');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if scriptPath not found', (done) => {
		setResponseFile('shellscriptGood.json');
		
		var tr = new trm.TaskRunner('ShellScript');
		tr.setInput('scriptPath', '/notExist.sh');
		tr.setInput('cwd', 'fake/wd');	
		tr.run()
		.then(() => {
			assert(tr.failed, 'should have failed');
            var expectedErr = 'not found scriptPath';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running ShellScript');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});