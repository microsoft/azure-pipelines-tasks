/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import shell = require('shelljs');
import os = require('os');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Grunt Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('runs a gruntFile through global grunt-cli', (done) => {
		setResponseFile('gruntGlobalGood.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
            assert(tr.ran('/usr/local/bin/grunt --gruntfile gruntfile.js'), 'it should have run grunt');
            assert(tr.invokedToolCount == 1, 'should have only run grunt');

			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	it('runs a gruntfile through local grunt-cli', (done) => {
		setResponseFile('gruntLocalGood.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
			if(os.type().match(/^Win/)) {
        		assert(tr.ran('/usr/local/bin/node c:\\fake\\wd\\node_modules\\grunt-cli\\bin\\grunt --gruntfile gruntfile.js'), 'it should have run grunt');
    		}
			else {
				assert(tr.ran('/usr/local/bin/node /fake/wd/node_modules/grunt-cli/bin/grunt --gruntfile gruntfile.js'), 'it should have run grunt');
			}
            
            assert(tr.invokedToolCount == 1, 'should have only run grunt');

			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
	
	it('fails if grunt-cli no exist globally and locally', (done) => {
		setResponseFile('gruntNoGruntCli.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
			assert(tr.invokedToolCount == 0, 'should exit before running grunt');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Grunt-cli is not installed globally (or is not in the path of the user the agent is running as) and it is not in the local working folder'));
            assert(tr.failed, 'task should have failed');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})

	it('errors if gruntfile not found', (done) => {
		setResponseFile('gruntNoGruntFile.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'not found gruntFile';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running Grunt');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})

	it('fails if grunt fails', (done) => {
		setResponseFile('gruntFails.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('targets', 'build test');
		tr.setInput('arguments', '-v');
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
			
            assert(tr.ran('/usr/local/bin/grunt build test --gruntfile gruntfile.js -v'), 'it should have run grunt');
            assert(tr.invokedToolCount == 1, 'should have only run Grunt');

            // success scripts don't necessarily set a result
			var expectedErr = '/usr/local/bin/grunt failed with return code: 1';
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
		setResponseFile('gruntGlobalGood.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: cwd';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running Grunt');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('errors if gruntFile not set', (done) => {
		setResponseFile('gruntGlobalGood.json');
		
		var tr = new trm.TaskRunner('Grunt');
		if (os.type().match(/^Win/)) {
        	tr.setInput('cwd', 'c:/fake/wd');
    	}
		else {
			tr.setInput('cwd', '/fake/wd');	
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: gruntFile';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running Grunt');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('errors if gruntCli not set', (done) => {		
		setResponseFile('gruntLocalGood.json');
		
		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('cwd', 'fake/wd');
		tr.run()
		.then(() => {
            assert(tr.failed, 'should have failed');
            var expectedErr = 'Input required: gruntCli';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running Grunt');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});