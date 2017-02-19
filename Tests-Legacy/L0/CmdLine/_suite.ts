/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('CmdLine Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('run cmdline in cwd', (done) => {
		setResponseFile('cmdlineGood.json');
		
		var tr = new trm.TaskRunner('CmdLine');
		tr.setInput('filename', 'cmd');
		tr.setInput('arguments', '/c cmd');
		tr.setInput('workingFolder', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/cmd /c cmd'), 'it should have run cmdline');
            assert(tr.invokedToolCount == 1, 'should have only run cmdline');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('fails if cmdline fails', (done) => {
		setResponseFile('cmdlineFails.json');
		
		var tr = new trm.TaskRunner('CmdLine');
		tr.setInput('filename', 'cmd');
		tr.setInput('arguments', '/c cmd');
		tr.setInput('workingFolder', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/cmd /c cmd'), 'it should have run cmdline');
            assert(tr.invokedToolCount == 1, 'should have only run cmdline');

			var expectedErr = '/usr/local/bin/cmd failed with return code: 1';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails cmdline on stderr fails', (done) => {
		setResponseFile('cmdlineStderrFails.json');
		
		var tr = new trm.TaskRunner('CmdLine');
		tr.setInput('filename', 'cmd');
		tr.setInput('arguments', '/c cmd');
		tr.setInput('workingFolder', 'fake/wd');
		tr.setInput('failOnStandardError', 'true');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/cmd /c cmd'), 'it should have run cmdline');
            assert(tr.invokedToolCount == 1, 'should have only run cmdline');

			var expectedErr = '/usr/local/bin/cmd failed with return code: 0';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('errors if workingFolder not set', (done) => {
		setResponseFile('cmdlineNoCwd.json');
		
		var tr = new trm.TaskRunner('CmdLine');
		tr.setInput('filename', 'cmd');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: workingFolder';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running CmdLine');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('errors if filename not set', (done) => {
		setResponseFile('cmdlineGood.json');
		
		var tr = new trm.TaskRunner('CmdLine');
		tr.setInput('workingFolder', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: filename';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running CmdLine');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});