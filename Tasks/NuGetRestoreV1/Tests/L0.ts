import * as path from 'path';
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NuGetRestore Suite', function () {
    it('restore solution', async () => {
        const tp = path.join(__dirname, 'singlesln.js')
        const tr = new ttm.MockTestRunner(tp);
        await tr.runAsync()
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have 1 error");
        assert.equal(tr.errorIssues[0], "loc_mock_DeprecatedTask", "Error should be about deprecation");
    }).timeout(20000);
});