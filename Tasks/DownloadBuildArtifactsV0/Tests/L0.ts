import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadBuildArtifactsV0 Suite', function () {
    let nodePath: string;

    before(async function () {
        this.timeout(120000);

        const setupRunner = new ttm.MockTestRunner(
            path.join(__dirname, 'L0NoBuildTypeProvidedFail.js')
        );
        await setupRunner.LoadAsync();
        nodePath = setupRunner.nodePath;
    });

    it('No build type provided should fail', async () => {
      const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
      tr.nodePath = nodePath;

      try {
          await tr.runAsync();
          assert(tr.stdOutContained('Input required: buildType'));
          assert(tr.failed, 'task should have failed');

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          throw err;
      };
  }).timeout(10000);
  
  it('No download path provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoDownloadPathProvidedFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    tr.nodePath = nodePath;

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadPath'));
        assert(tr.failed, 'task should have failed');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(5000);;

  it('No download type provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoDownloadTypeProvidedFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    tr.nodePath = nodePath;

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadType'));
        assert(tr.failed, 'task should have failed');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(5000);;
});
