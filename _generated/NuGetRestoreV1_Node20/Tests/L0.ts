import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGetRestore Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('restore solution', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'singlesln.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
        done();
    }).timeout(20000);

});