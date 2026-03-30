import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('DownloadGitHubReleaseV0 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('No connection specified should fail', async () => {
      const tp: string = path.join(__dirname, 'L0NoConnection.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      try {
          await tr.runAsync();
          assert(tr.stdOutContained('Input required: connection'));
          assert(tr.failed, 'task should have failed');

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          throw err;
      };
    }).timeout(20000);

  it('No user repository specified should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoUserRepository.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: userRepository'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('No default version specified should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoDefaultVersionType.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: defaultVersionType'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('No download path specified should fail', async () => {
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
  }).timeout(20000);

  it('Get latest release should fail', async () => {
    const tp: string = path.join(__dirname, 'L0GetLatestReleaseFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('Get latest release should succeded', async () => {
    const tp: string = path.join(__dirname, 'L0GetLatestReleaseValid.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('ArtifactsSuccessfullyDownloaded'));
        assert(tr.stdOutContained('DownloadArtifacts'));
        assert(tr.succeeded, 'task should have succeeded');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('Get specific release should fail', async () => {
    const tp: string = path.join(__dirname, 'L0GetSpecificReleaseFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('Get tagged release with specific tag should fail', async () => {
    const tp: string = path.join(__dirname, 'L0GetTaggedReleaseWithSpecificTagFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);

  it('Get tagged release with tag specified should fail', async () => {
    const tp: string = path.join(__dirname, 'L0GetTaggedReleaseWithTagFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('InvalidRelease'));
        assert(tr.failed, 'task should have failed');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);
});
