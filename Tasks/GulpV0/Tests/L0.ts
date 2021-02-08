import assert = require('assert');
import path = require('path');
import os = require('os');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

const isWin = os.type().match(/^Win/);

describe('GulpV0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done: Mocha.Done) => {
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = '/user/build';
        done();
    });

    it('runs a gulpfile through global gulp', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpGlobalGood.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 1, 'should have only run gulp');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('runs a gulpfile through local gulp', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpLocalGood.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        if (isWin) {
            assert(
                tr.ran('/usr/local/bin/node c:\\fake\\wd\\node_modules\\gulp\\gulp.js --gulpfile gulpfile.js'),
                'it should have run gulp'
            );
        } else {
            assert(
                tr.ran('/usr/local/bin/node /fake/wd/node_modules/gulp/gulp.js --gulpfile gulpfile.js'),
                'it should have run gulp'
            );
        }
        assert(tr.invokedToolCount == 1, 'should have only run gulp');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('runs gulp when code coverage is enabled', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpGlobalGoodWithCodeCoverage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 3, 'should have run npm, Gulp and istanbul');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('runs a gulpFile when publishJUnitTestResults is false', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0PublishJUnitTestResultsFalse.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 1, 'should have only run Gulp');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('fails if gulpFile not set', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpFileNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: gulpFile'), 'Should have printed: Input required: gulpFile');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if cwd not set', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0CwdNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: cwd'), 'Should have printed: Input required: cwd');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if gulpjs not set', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpjsNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: gulpjs'), 'Should have printed: Input required: gulpjs');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if gulpFile not found', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoGulpFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Not found gulpfile.js'), 'Should have printed: Not found gulpfile.js');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if gulp no exist globally and locally', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoGulp.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_GulpNotInstalled'), 'Should have printed: loc_mock_GulpNotInstalled');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if npm fails', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NpmFails.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_NpmFailed'), 'Should have printed: loc_mock_NpmFailed');
        assert(tr.invokedToolCount == 2, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if gulp fails', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpFails.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.stdOutContained('loc_mock_GulpFailed'), 'Should have printed: loc_mock_GulpFailed');
        assert(tr.invokedToolCount == 1, 'should have run npm and gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails if istanbul fails', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0IstanbulFails.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.stdOutContained('loc_mock_IstanbulFailed'), 'Should have printed: loc_mock_IstanbulFailed');
        assert(tr.invokedToolCount == 3, 'should have run npm, gulp and istanbul');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails when test result files input is not provided', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0TestResultFilesNotSet.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: testResultsFiles'), 'Should have printed: Input required: testResultsFiles');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('gives warning and runs when test result files input does not match any file', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0TestResultFilesDoesNotMatchAnyFile.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run gulp');
        assert(tr.invokedToolCount == 1, 'should run completely');
        assert(
            tr.stdout.search('No pattern found in testResultsFiles parameter') >= 0,
            'should give a warning for test file pattern not matched.'
        );
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('fails when test source files input is not provided for coverage', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0NoTestSourceFiles.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('Input required: testFiles'), 'Should have printed: Input required: testFiles');
        assert(tr.invokedToolCount == 0, 'should exit before running Gulp');
        assert(tr.failed, 'should have failed');

        done();
    });

    it('fails when test source files input does not match any file', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0InvalidTestSource.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdOutContained('loc_mock_IstanbulFaile'), 'Should have printed: loc_mock_IstanbulFaile');
        assert(tr.invokedToolCount == 3, 'should exit while running istanbul');
        assert(tr.failed, 'should have failed');

        done();
    });
});
