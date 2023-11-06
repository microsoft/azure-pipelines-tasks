import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadGitHubNugetPackageV1 Suite', function () {
  this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

  it('No package name provided should fail', (done: Mocha.Done) => {
    const tp: string = path.join(__dirname, 'L0NoPackageNameShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
      tr.run();

      assert(tr.stdOutContained('Error_InvalidPackageName'));
      assert(tr.failed, 'task should have failed');

      done();
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
      done(err);
    };
  });

  it('Invalid package name provided should fail', (done: Mocha.Done) => {
    const tp: string = path.join(__dirname, 'L0InvalidPackageNameShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    
    try {
      tr.run();

      assert(tr.stdOutContained('Error_InvalidPackageName'));
      assert(tr.failed, 'task should have failed');
      
      done();
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
      done(err);
    };
  });

  it('No endpoint provided should fail', (done: Mocha.Done) => {
    const tp: string = path.join(__dirname, 'L0NoEndpointProvidedShouldFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
      tr.run();

      assert(tr.stdOutContained("Cannot read property 'toLowerCase' of undefined"));
      assert(tr.failed, 'task should have failed');

      done();
    } catch (err) {
      console.log(tr.stdout);
      console.log(tr.stderr);
      console.log(err);
      done(err);
    };
  });
});