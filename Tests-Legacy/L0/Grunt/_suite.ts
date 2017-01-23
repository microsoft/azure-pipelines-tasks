/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

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

describe('Grunt Suite', function () {
    this.timeout(20000);

	before((done) => {
		// init here
		done();
	});

	after(function () {

	});

	it('runs a gruntFile through global grunt-cli', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
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
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				if (os.type().match(/^Win/)) {
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

	it('runs a gruntFile when code coverage is enabled', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'true');
		tr.setInput('testFramework', 'Mocha');
		tr.setInput('srcFiles', '**/build/src/*.js');
		tr.setInput('testFiles', '**/build/test/*.js');
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
				assert(tr.invokedToolCount == 3, 'should have only npm, grunt and istanbul');
				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('runs a gruntFile when publishJUnitTestResults is false', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'false');
		tr.setInput('enableCodeCoverage', 'false');
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

	it('fails if grunt-cli no exist globally and locally', (done) => {
		setResponseFile('gruntNoGruntCli.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
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

	it('fails if npm fails', (done) => {
		setResponseFile('npmFails.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'true');
		tr.setInput('testFramework', 'Mocha');
		tr.setInput('srcFiles', '**/build/src/*.js');
		tr.setInput('testFiles', '**/build/test/*.js');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				assert(tr.invokedToolCount == 2, 'should have only run npm');

				// success scripts don't necessarily set a result
				var expectedErr = '/usr/local/bin/npm failed with return code: 1';
				assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
				assert(tr.stderr.length > 0, 'should not have written to stderr');
				assert(tr.failed, 'task should have failed');
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
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
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
				assert(tr.invokedToolCount == 1, 'should have only run npm and Grunt');

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

	it('fails if istanbul fails', (done) => {
		setResponseFile('istanbulFails.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'true');
		tr.setInput('testFramework', 'Mocha');
		tr.setInput('srcFiles', '**/build/src/*.js');
		tr.setInput('testFiles', '**/build/test/*.js');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				assert(tr.invokedToolCount == 3, 'should have only run npm and Grunt');
				assert(tr.stdErrContained("Istanbul failed with error"), 'Istanbul should have failed');
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

	it('Fails when test result files input is not provided', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.stdErrContained('Input required: testResultsFiles'));
				assert(tr.failed, 'task should have failed');
				assert(tr.invokedToolCount == 0, 'should exit before running gulp');

				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('gives warning and runs when test result files input does not match any file', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '/invalid/input');
		tr.setInput('enableCodeCoverage', 'false');
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
				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.invokedToolCount == 1, 'should run completely');
				assert(tr.stdout.search('No pattern found in testResultsFiles parameter') >= 0, 'should give a warning for test file pattern not matched.');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('Fails when test source files input is not provided for coverage', (done) => {
		setResponseFile('gruntGlobalGood.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'true');
		tr.setInput('testFramework', 'Mocha');
		tr.setInput('srcFiles', '**/build/src/*.js');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.stdErrContained('Input required: testFiles'));
				assert(tr.failed, 'task should have failed');
				assert(tr.invokedToolCount == 0, 'should exit before running grunt');

				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails when test source files input does not match any file', (done) => {
		setResponseFile('invalidTestSource.json');

		var tr = new trm.TaskRunner('Grunt');
		tr.setInput('gruntFile', 'gruntfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'true');
		tr.setInput('testFramework', 'Mocha');
		tr.setInput('srcFiles', '**/build/src/*.js');
		tr.setInput('testFiles', '/invalid/input');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gruntCli', 'node_modules/grunt-cli/bin/grunt');
		tr.run()
			.then(() => {
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.failed, 'task should have failed');
				assert(tr.invokedToolCount == 3, 'should exit while running istanbul');
				assert(tr.stdErrContained('Istanbul failed with error'));
				done();
			})
			.fail((err) => {
				done(err);
			});
	})


});	
