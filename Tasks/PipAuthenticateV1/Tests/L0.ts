import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from "azure-pipelines-task-lib";

describe('Pip Authenticate V1 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 10000);

    before(() => {
    });

    after(() => {
    });

    it('sets authentication for current organization feed', (done: Mocha.Done) => {
        let tp = path.join(__dirname, './setAuthInternalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 0, 'no tool should be invoked.');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        assert(tr.stdOutContained('Successfully added auth for 1 internal feeds and 0 external endpoint'),
        'it should have succeeded in adding auth for 1 feed');
        done();
    });
});