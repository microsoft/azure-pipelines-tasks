import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadBuildArtifactsV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('No build type provided should fail', (done) => {
      const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      try {
          tr.run();
          assert(tr.stdOutContained('Input required: buildType'));
          assert(tr.failed, 'task should have failed');
          done();

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          done(err);
      };
  }).timeout(5000);
  
  it('No download path provided should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoDownloadPathProvidedFail.js');
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
  });

  it('No download type provided should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoDownloadTypeProvidedFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('Input required: downloadType'));
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
