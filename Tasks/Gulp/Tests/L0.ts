import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import os = require('os');

describe('Gulp Task', function () {
    before(() => {
    });

    after(() => {
    });

    it("runs a gulpfile through global gulp", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0Default.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 1, 'should have only run Gulp');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it("runs multiple gulpfiles through global gulp", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0MultipleGulpFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile /user/build/one/gulpfile.js'), 'it should have run Gulp in directory, one');
        assert(tr.ran('/usr/local/bin/gulp --gulpfile /user/build/two/gulpfile.js'), 'it should have run Gulp in directory, two');
        assert(tr.invokedToolCount == 2, 'should have only run Gulp for two gulp files');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it("runs a gulpfile through local gulp", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0GulpLocalDefault.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
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
    });

    it("runs gulp when code coverage is enabled", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0GulpCodeCoverage.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 3, 'should have run npm, Gulp and istanbul');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it("runs a gulpfile when publishJUnitTestResults is false", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0PublishResultFalse.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 1, 'should have only run Gulp');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it("fails if gulpFile not set", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0GulpFileNotSet.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'should have failed');
        var expectedErr = 'Error: Input required: gulpFile';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');

        done();
    });

    it("fails if cwd not set", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0CwdNotSet.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'should have failed');
        var expectedErr = 'Error: Input required: cwd';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');

        done();
    });

    it("fails if gulpjs not set", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0GulpJsNotSet.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        var expectedErr = 'Error: Input required: gulpjs';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running gulp');

        done();
    });

    it("fails if gulpFile not found", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0NoGulpFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'should have failed');
        var expectedErr = 'Error: Not found gulpfile.js';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        done();
    });

    it("fails if gulp no exist globally and locally", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0NoGulp.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        var expectedErr = 'loc_mock_GulpNotInstalled c:\\fake\\wd\\node_modules\\gulp\\gulp.js';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        
        assert(tr.failed, 'task should have failed');

        done();
    });

    it("fails if npm fails", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0NpmFail.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.invokedToolCount == 2, 'should have exited before running gulp');

        var expectedErr = 'Error: loc_mock_NpmFailed /usr/local/bin/npm failed with return code: 1';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');

        done();
    });

    it("fails if gulp fails", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0GulpFail.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.invokedToolCount == 1, 'should have run npm and gulp');

        var expectedErr = 'Error: loc_mock_GulpFailed /usr/local/bin/gulp failed with return code: 1';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');

        done();
    });

    it("fails if istanbul fails", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0IstanbulFail.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.invokedToolCount == 3, 'should have run npm, gulp and istanbul');
        var expectedErr = 'Error: loc_mock_IstanbulFailed /usr/local/bin/node failed with return code: 1';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');

        done();
    });

    it("Fails when test result files input is not provided", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0TestResultFileAbsent.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        var expectedErr = 'Error: Input required: testResultsFiles';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running gulp');

        done();
    });

    it("gives warning and runs when test result files input does not match any file", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0TestResultFileNoMatch.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.invokedToolCount == 1, 'should run completely');
        assert(tr.stdout.search('No pattern found in testResultsFiles parameter') >= 0, 'should give a warning for test file pattern not matched.');

        done();
    });

    it("Fails when test source files input is not provided for coverage", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0TestSourceFileAbsent.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        var expectedErr = 'Error: Input required: testFiles';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should exit before running gulp');
        done();
    });

    it("fails when test source files input does not match any file", (done: MochaDone) => {
        this.timeout(1000);
        let tp = path.join(__dirname, 'L0TestSourceFileNoMatch.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        var expectedErr = 'Error: loc_mock_IstanbulFailed /usr/local/bin/node failed with return code: 1';
        assert(tr.errorIssues.length > 0 || tr.stderr.length > 0, 'should have written to stderr');
        assert(tr.stdErrContained(expectedErr) || tr.createdErrorIssue(expectedErr), 'should have said: ' + expectedErr);
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 3, 'should exit while running istanbul');
        done();
    });

});