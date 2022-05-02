import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureFunctionApp Suite', function () {
  this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

  it('Simple test', (done: Mocha.Done) => {
    this.timeout(1000);

    let tp: string = path.join(__dirname, 'L0SimpleTest.js');
    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    tr.run();

    assert(tr.errorIssues.length === 0 && tr.stderr.length === 0, 'should not have written to stderr');
    assert(tr.succeeded, 'task should have succeeded');

    done();
  });
});
