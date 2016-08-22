/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
import shell = require('shelljs');
import os = require('os');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Gulp Suite', function () {
    this.timeout(20000);

	before((done) => {
		// init here
		done();
	});

	after(function () {

	});

	it('runs a gulpfile through global gulp', (done) => {
		setResponseFile('gulpGlobalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
				assert(tr.invokedToolCount == 1, 'should have only run Gulp');

				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('runs a gulpfile through local gulp', (done) => {
		setResponseFile('gulpLocalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				if (os.type().match(/^Win/)) {
					assert(tr.ran('/usr/local/bin/node c:\\fake\\wd\\node_modules\\gulp\\gulp.js --gulpfile gulpfile.js'), 'it should have run gulp');
				}
				else {
					assert(tr.ran('/usr/local/bin/node /fake/wd/node_modules/gulp/gulp.js --gulpfile gulpfile.js'), 'it should have run gulp');
				}

				assert(tr.invokedToolCount == 1, 'should have only run gulp');

				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('runs gulp when code coverage is enabled', (done) => {
		setResponseFile('gulpGlobalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
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
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
				assert(tr.invokedToolCount == 3, 'should have run npm, Gulp and istanbul');
				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('runs a gulpfile when publishJUnitTestResults is false', (done) => {
		setResponseFile('gulpGlobalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'false');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
				assert(tr.invokedToolCount == 1, 'should have only run Gulp');

				assert(tr.stderr.length == 0, 'should not have written to stderr');
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if gulpFile not set', (done) => {
		setResponseFile('gulpGlobalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.failed, 'should have failed');
				var expectedErr = 'Input required: gulpFile';
				assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if cwd not set', (done) => {
		setResponseFile('gulpGlobalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.failed, 'should have failed');
				var expectedErr = 'Input required: cwd';
				assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if gulpjs not set', (done) => {
		setResponseFile('gulpLocalGood.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		// don't set gulpjs
		tr.run()
			.then(() => {
				//assert(tr.cwd === '/fake/wd');
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.stdErrContained('Input required: gulpjs'));
				assert(tr.failed, 'task should have failed');
				assert(tr.invokedToolCount == 0, 'should exit before running gulp');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if gulpFile not found', (done) => {
		setResponseFile('gulpNoGulpFile.json');

		var tr = new trm.TaskRunner('Gulp');

		tr.setInput('gulpFile', 'gulpfile.js');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.failed, 'should have failed');
				var expectedErr = 'not found gulpFile';
				assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if gulp no exist globally and locally', (done) => {
		setResponseFile('gulpNoGulp.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.stdErrContained('Gulp is not installed globally (or is not in the path of the user the agent is running as) and it is not in the local working folder'));
				assert(tr.failed, 'task should have failed');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if npm fails', (done) => {
		setResponseFile('npmFails.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
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
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.invokedToolCount == 2, 'should have exited before running gulp');

				// success scripts don't necessarily set a result
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

	it('fails if gulp fails', (done) => {
		setResponseFile('gulpFails.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
		tr.setInput('enableCodeCoverage', 'false');
		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
				assert(tr.invokedToolCount == 1, 'should have run npm and gulp');

				// success scripts don't necessarily set a result
				var expectedErr = '/usr/local/bin/gulp failed with return code: 1';
				assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.failed, 'task should have failed');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('fails if istanbul fails', (done) => {
		setResponseFile('istanbulFails.json');

		var tr = new trm.TaskRunner('Gulp');
		tr.setInput('gulpFile', 'gulpfile.js');
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
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');
		tr.run()
			.then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
				assert(tr.invokedToolCount == 3, 'should have run npm, gulp and istanbul');
				assert(tr.stdErrContained("Istanbul failed with error"), 'Istanbul should fail');
				assert(tr.stderr.length > 0, 'should have written to stderr');
				assert(tr.failed, 'task should have failed');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})

	it('Fails when test result files input is not provided', (done) => {
        setResponseFile('gulpGlobalGood.json');

        var tr = new trm.TaskRunner('Gulp');
        tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('enableCodeCoverage', 'false');

		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');

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
        setResponseFile('gulpGlobalGood.json');

        var tr = new trm.TaskRunner('Gulp');
        tr.setInput('gulpFile', 'gulpfile.js');
		tr.setInput('publishJUnitResults', 'true');
		tr.setInput('testResultsFiles', '/invalid/input');
		tr.setInput('enableCodeCoverage', 'false');

		if (os.type().match(/^Win/)) {
			tr.setInput('cwd', 'c:/fake/wd');
		}
		else {
			tr.setInput('cwd', '/fake/wd');
		}
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');

        tr.run()
            .then(() => {
				assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
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
        setResponseFile('gulpGlobalGood.json');

        var tr = new trm.TaskRunner('Gulp');
        tr.setInput('gulpFile', 'gulpfile.js');
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
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');

        tr.run()
            .then(() => {
				assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: testFiles'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running gulp');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

	it('fails when test source files input does not match any file', (done) => {
        setResponseFile('invalidTestSource.json');

        var tr = new trm.TaskRunner('Gulp');
        tr.setInput('gulpFile', 'gulpfile.js');
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
		tr.setInput('gulpjs', 'node_modules/gulp/gulp.js');

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