import * as assert from 'assert';
import path = require('path');

import * as ttm from 'azure-pipelines-task-lib/mock-test';

import { TestString } from './TestStrings';

const TIMEOUT_IN_MS = 90_000;

describe('TestUtils', function () {
  it('should unzip a release', async () => {
    this.timeout(TIMEOUT_IN_MS);
    const tr = new ttm.MockTestRunner(path.join(__dirname, 'UnzipL0Tests.js'));

    await tr.runAsync();

    assert(tr.stdOutContained(TestString.PathExists), "should have printed: " + TestString.PathExists);
    assert(tr.stdOutContained(TestString.PathNotExists), "should have printed: " + TestString.PathNotExists);
    assert(tr.stdOutContained(TestString.Err_ExtractionFailed), "should have printed: " + TestString.Err_ExtractionFailed);
  });

  it('should get a release', async () => {
    this.timeout(TIMEOUT_IN_MS);
    const tr = new ttm.MockTestRunner(path.join(__dirname, 'GetKubeloginReleaseL0Tests.js'));

    await tr.runAsync();

    assert(tr.stdOutContained(TestString.Found0_0_29), 'should have printed: ' + TestString.Found0_0_29);
    assert(tr.stdOutContained(TestString.PlatformCorrect0_0_29), 'should have printed: ' + TestString.PlatformCorrect0_0_29);
    assert(tr.stdOutContained(TestString.ReleaseUrlValid0_0_29), 'should have printed: ' + TestString.ReleaseUrlValid0_0_29);
    assert(tr.stdOutContained(TestString.CheckSumValid0_0_29), 'should have printed: ' + TestString.CheckSumValid0_0_29);
    assert(tr.stdOutContained(TestString.Foundv0_0_29), 'should have printed: ' + TestString.Foundv0_0_29);
    assert(tr.stdOutContained(TestString.PlatformCorrectv0_0_29), 'should have printed: ' + TestString.PlatformCorrectv0_0_29);
    assert(tr.stdOutContained(TestString.ReleaseUrlValidv0_0_29), 'should have printed: ' + TestString.ReleaseUrlValidv0_0_29);
    assert(tr.stdOutContained(TestString.CheckSumValidv0_0_29), 'should have printed: ' + TestString.CheckSumValidv0_0_29);
    assert(tr.stdOutContained(TestString.Foundlatest), 'should have printed: ' + TestString.Foundlatest);
    assert(tr.stdOutContained(TestString.PlatformCorrectlatest), 'should have printed: ' + TestString.PlatformCorrectlatest);
    assert(tr.stdOutContained(TestString.ReleaseUrlValidlatest), 'should have printed: ' + TestString.ReleaseUrlValidlatest);
    assert(tr.stdOutContained(TestString.CheckSumValidlatest), 'should have printed: ' + TestString.CheckSumValidlatest);
    assert(tr.stdOutContained(TestString.NotFound123_1323), 'should have printed: ' + TestString.NotFound123_1323);
  });

  it('should handle HTTP errors correctly', async () => {
    this.timeout(TIMEOUT_IN_MS);
    await new ttm.MockTestRunner(path.join(__dirname, 'GetKubeloginReleaseErrorHandlingL0Tests.js')).runAsync();
  });

  it('should resolve a platform', async () => {
    this.timeout(TIMEOUT_IN_MS);
    const tr = new ttm.MockTestRunner(path.join(__dirname, 'ResolvePlatformL0Tests.js'));

    await tr.runAsync();

    assert(tr.stdOutContained(TestString.darwinamd64), 'should have printed: ' + TestString.darwinamd64);
    assert(tr.stdOutContained(TestString.darwinarm64), 'should have printed: ' + TestString.darwinarm64);
    assert(tr.stdOutContained(TestString.linuxamd64), 'should have printed: ' + TestString.linuxamd64);
    assert(tr.stdOutContained(TestString.linuxarm64), 'should have printed: ' + TestString.linuxarm64);
    assert(tr.stdOutContained(TestString.winamd64), 'should have printed: ' + TestString.winamd64);
    assert(tr.stdOutContained(TestString.unsupported), 'should have printed: ' + TestString.unsupported);
  });

  it('should run successfully when installing Kublogin', async () => {
    this.timeout(TIMEOUT_IN_MS);
    const testPath: string = path.join(__dirname, 'InstallKubeloginL0Tests.js');
    const tr = new ttm.MockTestRunner(testPath);

    await tr.runAsync();

    assert(tr.succeeded, TestString.TaskSucceeded);
  });

  it('should fail when downloading kubelogin fails', async () => {
    this.timeout(TIMEOUT_IN_MS);
    const testPath: string = path.join(__dirname, 'InstallKubeloginL0TestsDownloadFails.js');
    const tr = new ttm.MockTestRunner(testPath);

    await tr.runAsync();

    assert(tr.failed, TestString.TaskFailed);
    assert(tr.stdOutContained(TestString.loc_mock_Info_DownloadingFailed), 'should have printed: ' + TestString.loc_mock_Info_DownloadingFailed);
  });
});
