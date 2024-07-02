import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadFileshareArtifactsV1 Suite', function () {
    it('No download path should fail', async () => {
      const tp: string = path.join(__dirname, 'L0NoDownloadPath.js');
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
  }).timeout(30_000);

  it('No file share path should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoFileSharePath.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: filesharePath'));
        assert(tr.failed, 'task should have failed');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(30_000);

  it('No artifact name should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoArtifactName.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: artifactName'));
        assert(tr.failed, 'task should have failed');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  });

  it('Invalid artifact location should succeded', async () => {
    const tp: string = path.join(__dirname, 'L0ArtifactNameDirectoryNotFound.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('ArtifactNameDirectoryNotFound'));
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.succeeded, 'task should have succeeded');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  });

  it('Valid artifact location should succeded', async () => {
    const tp: string = path.join(__dirname, 'L0DonwloadFileShareArtifactsValid.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(!tr.stdOutContained('ArtifactNameDirectoryNotFound'));
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.succeeded, 'task should have succeeded');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  });
});
