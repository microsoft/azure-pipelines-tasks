import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { Done } from 'mocha';

var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('Cmd Suite', function () {
    this.timeout(60000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    // Just need inline case since external scripts not allowed.
    it('Runs an inline script correctly', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0Inline.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Cmd should have succeeded.');
            assert(tr.stderr.length === 0, 'Cmd should not have written to stderr');
            assert(tr.stdout.indexOf('my script output') > 0,'Cmd should have correctly run the script');
        }, tr, done);
    });

    it('Reports stderr correctly', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0StdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]myErrorTest') > 0, 'Bash should have correctly written myErrorTest');
            assert(tr.stdout.length > 1000, 'Bash stderr output is not truncated');
        }, tr, done);
    });

    it('Fails on null exit code', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailOnExitCodeNull.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'Bash should have failed when the script exits with null code');
        }, tr, done);
    });

    it('Should escape percents if disablePercentEscaping is enabled', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0PercentsEscapingEnabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'Cmd should have succeeded.');
            assert(tr.stderr.length === 0, 'Cmd should not have written to stderr');
            assert(tr.stdOutContained('Percents string - %3 %abc %% %123 "%"'), 'Cmd should escape percent character by defaults');
        }, tr, done);
    });

    it('Should not escape percents if disablePercentEscaping disabled', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0PercentsEscapingDisabled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            console.info(tr.stdout);
            assert(tr.succeeded, 'Cmd should have succeeded.');
            assert(tr.stderr.length === 0, 'Cmd should not have written to stderr');
            assert(tr.stdOutContained('Percents string - abc  23 ""'), 'Cmd should not escape percent character if disablePercentEscaping is true');
        }, tr, done);
    });

    if (psm.testSupported()) {
        it('Should not escape percents if disablePercentEscaping disabled', (done) => {
            psr.run(path.join(__dirname, 'L0PercentsEscapingDisabled.ps1'), done);
        })

        it('Should escape percents if disablePercentEscaping is enabled', (done) => {
            psr.run(path.join(__dirname, 'L0PercentsEscapingEnabled.ps1'), done);
        })
    }

    after(function () {
        if (psr) {
            psr.kill();
        }
    });
});
