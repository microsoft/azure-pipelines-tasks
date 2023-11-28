import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from "azure-pipelines-task-lib/task";

describe('DownloadPackageV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: Mocha.Done) {
        // TODO - add real tests
        let tp = path.join(__dirname, 'basic.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run()
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], tl.loc("DeprecatedTask"), "Error should be about deprecation");
        done();
    });
});
