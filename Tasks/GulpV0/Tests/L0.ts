import fs = require('fs');
import assert = require('assert');
import path = require('path');
import os = require('os');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

const isWin = os.type().match(/^Win/);

describe('GulpV0 Suite', function () {
    before((done: Mocha.Done) => {
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = '/user/build';
        done();
    });

    it('runs a gulpfile through global gulp', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpGlobalGood.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 1, 'should have only run Gulp');
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
        assert(tr.invokedToolCount == 1, 'should have only run grunt');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('runs gulp when code coverage is enabled', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'L0GulpGlobalGoodWithCodeCoverage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        console.log(tr.stdout);
        assert(tr.ran('/usr/local/bin/gulp --gulpfile gulpfile.js'), 'it should have run Gulp');
        assert(tr.invokedToolCount == 3, 'should have run npm, Gulp and istanbul');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

});
