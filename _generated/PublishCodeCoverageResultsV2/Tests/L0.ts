import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import assert = require('assert');
import path = require('path');

describe('PublishCodeCoverageResultsV2 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 15000);

    before(() => {
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    });

    it('Publish Code coverage results with Summary file matches', async function() {
        const testPath = path.join(__dirname, 'L0SummaryFileLocationMatches.ts')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
    });

    it('Publish Code coverage results should work fine with empty results', async function() {
        const testPath = path.join(__dirname, 'L0NotFailWithEmptyResults.ts')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');  // It will give a message of No code coverage for empty inputs
    });

});
