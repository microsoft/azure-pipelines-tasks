import assert = require('node:assert');
import path = require('node:path');

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadGitHubNugetPackageV1 Suite', function () {
  this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

  it('No package name provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoPackageNameShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
      await tr.runAsync();
      assert(tr.stdOutContained('Error_InvalidPackageName'));
      assert(tr.failed, 'task should have failed');
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
    };
  });

  it('Invalid package name provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0InvalidPackageNameShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
      await tr.runAsync();
      assert(tr.stdOutContained('Error_InvalidPackageName'));
      assert(tr.failed, 'task should have failed');
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
    };
  });

  it('No endpoint provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoEndpointProvidedShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
      await tr.runAsync();
      assert(tr.stdOutContained("Cannot read properties of undefined (reading 'toLowerCase')"));
      assert(tr.failed, 'task should have failed');
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
    };
  });
});