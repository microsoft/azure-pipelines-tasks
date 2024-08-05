import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('Pip Authenticate V1 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 10000);

    before(() => {
    });

    after(() => {
    });

    it('sets authentication for current organization feed', (done: Mocha.Done) => {
        let tp = path.join(__dirname, './setAuthInternalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync();
        assert(tr.invokedToolCount == 0, 'no tool should be invoked.');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});