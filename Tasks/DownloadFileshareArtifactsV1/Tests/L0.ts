import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadFileshareArtifactsV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('No download path should fail', (done) => {
      const tp: string = path.join(__dirname, 'L0NoDownloadPath.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      try {
          tr.run();
          assert(tr.stdOutContained('Input required: downloadPath'));
          assert(tr.failed, 'task should have failed');
          done();

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          done(err);
      };
  }).timeout(5000);

  it('No file share path should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoFileSharePath.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('Input required: filesharePath'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('No artifact name should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoArtifactName.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('Input required: artifactName'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Invalid artifact location should succeded', (done) => {
    const tp: string = path.join(__dirname, 'L0ArtifactNameDirectoryNotFound.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('ArtifactNameDirectoryNotFound'));
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.succeeded, 'task should have succeeded');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Valid artifact location should succeded', (done) => {
    const tp: string = path.join(__dirname, 'L0DonwloadFileShareArtifactsValid.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(!tr.stdOutContained('ArtifactNameDirectoryNotFound'));
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.succeeded, 'task should have succeeded');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });
});
