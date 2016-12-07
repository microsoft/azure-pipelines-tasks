/// <reference path="../../../definitions/mocha.d.ts"/>

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');

describe("AzureAppServiceManage Suite",function(){
    it("Runs successfully with default inputs", (done) => {
        let tp = path.join(__dirname, 'L0Default.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stderr.length == 0, "should not have written to stderr");
        var expectedOutput = "Successfully swapped web app slots";
        assert(tr.stdout.search(expectedOutput) >= 0, "should have said "+expectedOutput);
        expectedOutput = "Updated slot swap history to kudu with status as successful";
        assert(tr.stdout.search(expectedOutput) >= 0, "should have said "+expectedOutput);
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Fails if slot swap call fails", (done) => {
        let tp = path.join(__dirname, 'L0FailDefault.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedError = "Failed to swap web app slots";
        assert(tr.stderr.search(expectedOutput) >= 0, "should have said "+expectedError);
        var expectedOutput = "Updated slot swap history to kudu with status as failed";
        assert(tr.stdout.search(expectedOutput) >= 0, "should have said "+expectedOutput);
        assert(tr.failed, "task should have failed");
        done();
    });

    it("Fails when source and target slot are same", (done) => {
        let tp = path.join(__dirname, 'L0SourceTargetSame.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var expectedError = "Source and target slot cannot be same";
        assert(tr.stderr.search(expectedOutput) >= 0, "should have said "+expectedError);
        var expectedOutput = "Updated slot swap history to kudu with status as failed";
        assert(tr.stdout.search(expectedOutput) < 0, "should not update history to kudu");
        assert(tr.failed, "task should have failed");
        done();
    });
});
