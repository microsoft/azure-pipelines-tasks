import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadGitHubReleaseV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('No connection specified should fail', (done) => {
      const tp: string = path.join(__dirname, 'L0NoConnection.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      try {
          tr.run();
          assert(tr.stdOutContained('Input required: connection'));
          assert(tr.failed, 'task should have failed');
          done();

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          done(err);
      };
  });

  it('No user repository specified should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoUserRepository.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('Input required: userRepository'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('No default version specified should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0NoDefaultVersionType.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('Input required: defaultVersionType'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('No download path specified should fail', (done) => {
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
  });

  it('Get latest release should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0GetLatestReleaseFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Get latest release should succeded', (done) => {
    const tp: string = path.join(__dirname, 'L0GetLatestReleaseValid.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.stdOutContained('DownloadArtifacts'));
        assert(tr.succeeded, 'task should have succeeded');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Get specific release should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0GetSpecificReleaseFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Get tagged release with specific tag should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0GetTaggedReleaseWithSpecificTagFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');
        done();

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        done(err);
    };
  });

  it('Get tagged release with tag specified should fail', (done) => {
    const tp: string = path.join(__dirname, 'L0GetTaggedReleaseWithTagFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        tr.run();
        assert(tr.stdOutContained('InvalidRelease'));
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
