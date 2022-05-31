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
        tr.run();
        assert(tr.ran('pod --version'), 'it should run pod --version');
        assert(tr.ran('pod install --repo-update'), 'it should run pod install');
        done();
    });
});
