import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('CocoaPodsV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('run pod', function(done: Mocha.Done) {
        let tp: string = path.join(__dirname, 'L0DefaultRunner.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.ran('pod --version'), 'it should run pod --version');
            assert(tr.ran('pod install'), 'it should run pod install');
        } catch(err) {
             console.log(tr.stdout);
             console.log(tr.stderr);
             console.log(err);
        } finally {
            done();
        }
    });
});
