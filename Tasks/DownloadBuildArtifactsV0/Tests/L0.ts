import assert = require('assert');
import path = require('path');
import * as childProcess from 'child_process';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadBuildArtifactsV0 Suite', function () {
    it('loads runtime dependencies without crypto.randomUUID', () => {
        const taskDirectory = path.join(__dirname, '..');
        const result = childProcess.spawnSync(process.execPath, [
            '-e',
            'delete require("crypto").randomUUID; require(process.argv[1]); require(process.argv[2]);',
            require.resolve('azure-pipelines-task-lib/task', { paths: [taskDirectory] }),
            require.resolve('artifact-engine/Engine', { paths: [taskDirectory] })
        ], {
            encoding: 'utf8',
            env: { ...process.env, INPUT_ARTIFACT_COMPATIBILITY: 'value' }
        });

        assert.ifError(result.error);
        assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    });

    it('No build type provided should fail', async () => {
      const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

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
