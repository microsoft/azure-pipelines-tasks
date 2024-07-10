import path = require('path');
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestString } from './TestStrings';

describe('TestUtils', function () {
  it('should unzip a release', (done: Mocha.Done) => {
    const taskPath = path.join(__dirname, 'UnzipL0Tests.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);

    tr.run();

    assert(tr.stdOutContained(TestString.PathExists), "should have printed: " + TestString.PathExists);
    assert(tr.stdOutContained(TestString.PathNotExists), "should have printed: " + TestString.PathNotExists);
    assert(tr.stdOutContained(TestString.Err_ExtractionFailed), "should have printed: " + TestString.Err_ExtractionFailed);

    done();
  }).timeout(20000);

  it('should get a release', (done: Mocha.Done) => {
    const taskPath = path.join(__dirname, 'GetKubeloginReleaseL0Tests.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);

    tr.run();

    assert(tr.stdOutContained(TestString.Found0_0_29), 'should have printed: ' + TestString.Found0_0_29);
    assert(tr.stdOutContained(TestString.PlatformCorrect0_0_29), 'should have printed: ' + TestString.PlatformCorrect0_0_29);
    assert(tr.stdOutContained(TestString.ReleaseUrlValid0_0_29), 'should have printed: ' + TestString.ReleaseUrlValid0_0_29);
    assert(tr.stdOutContained(TestString.CheckSumValid0_0_29), 'should have printed: ' + TestString.CheckSumValid0_0_29);
    assert(tr.stdOutContained(TestString.Foundv0_0_29), 'should have printed: ' + TestString.Foundv0_0_29);
    assert(tr.stdOutContained(TestString.PlatformCorrectv0_0_29), 'should have printed: ' + TestString.PlatformCorrectv0_0_29);
    assert(tr.stdOutContained(TestString.ReleaseUrlValidv0_0_29), 'should have printed: ' + TestString.ReleaseUrlValidv0_0_29);
    assert(tr.stdOutContained(TestString.CheckSumValidv0_0_29), 'should have printed: ' + TestString.CheckSumValidv0_0_29);
    //assert(tr.stdOutContained(TestString.Foundlatest), 'should have printed: ' + TestString.Foundlatest);
    assert(tr.stdOutContained(TestString.Foundlatest), tr.stdout);
    assert(tr.stdOutContained(TestString.PlatformCorrectlatest), 'should have printed: ' + TestString.PlatformCorrectlatest);
    assert(tr.stdOutContained(TestString.ReleaseUrlValidlatest), 'should have printed: ' + TestString.ReleaseUrlValidlatest);
    assert(tr.stdOutContained(TestString.CheckSumValidlatest), 'should have printed: ' + TestString.CheckSumValidlatest);
    assert(tr.stdOutContained(TestString.NotFound123_1323), 'should have printed: ' + TestString.NotFound123_1323);

    done();
  }).timeout(20000);

  it('should resolve a platform', (done: Mocha.Done) => {
    const taskPath = path.join(__dirname, 'ResolvePlatformL0Tests.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);

    tr.run();

    assert(tr.stdOutContained(TestString.darwinamd64), 'should have printed: ' + TestString.darwinamd64);
    assert(tr.stdOutContained(TestString.darwinarm64), 'should have printed: ' + TestString.darwinarm64);
    assert(tr.stdOutContained(TestString.linuxamd64), 'should have printed: ' + TestString.linuxamd64);
    assert(tr.stdOutContained(TestString.linuxarm64), 'should have printed: ' + TestString.linuxarm64);
    assert(tr.stdOutContained(TestString.winamd64), 'should have printed: ' + TestString.winamd64);
    assert(tr.stdOutContained(TestString.unsupported), 'should have printed: ' + TestString.unsupported);

    done();
  }).timeout(20000);

  it('should run successfully when installing Kublogin', function () {
    const testPath: string = path.join(__dirname, 'InstallKubeloginL0Tests.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

    tr.run();

    assert(tr.succeeded, TestString.TaskSucceeded);
  }).timeout(20000);

  it('should fail when downloading kubelogin fails', function () {
    const testPath: string = path.join(__dirname, 'InstallKubeloginL0TestsDownloadFails.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

    tr.run();

    assert(tr.failed, TestString.TaskFailed);
    assert(tr.stdOutContained(TestString.loc_mock_Info_DownloadingFailed), 'should have printed: ' + TestString.loc_mock_Info_DownloadingFailed);
  }).timeout(20000);
});
