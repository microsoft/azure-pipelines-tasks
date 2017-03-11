/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('CMake Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('run cmake in cwd', (done) => {
		setResponseFile('cmakeGood.json');
		
		var tr = new trm.TaskRunner('CMake');
		tr.setInput('cmakeArgs', '..');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/cmake ..'), 'it should have run cmake');
            assert(tr.invokedToolCount == 1, 'should have only run cmake');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('fails if cmake fails', (done) => {
		setResponseFile('cmakeFails.json');
		
		var tr = new trm.TaskRunner('CMake');
		tr.setInput('cmakeArgs', '..');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/cmake ..'), 'it should have run cmake');
            assert(tr.invokedToolCount == 1, 'should have only run cmake');

			var expectedErr = '/usr/local/bin/cmake failed with return code: 1';
			assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
			assert(tr.stderr.length > 0, 'should not have written to stderr');
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('errors if cwd not set', (done) => {
		setResponseFile('cmakeNoCwd.json');
		
		var tr = new trm.TaskRunner('CMake');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: cwd';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running CMake');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});