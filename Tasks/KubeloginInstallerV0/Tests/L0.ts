import path = require('path');
import * as assert from 'assert';

import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestString } from './TestStrings';

describe('TestUtils', function () {
  it('test unzip a release', (done: Mocha.Done) => {
    const taskPath = path.join(__dirname, 'UnzipL0Tests.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(taskPath);

    tr.run();

    assert(tr.stdOutContained('unzip path exist'), 'should have printed: unzip path exist');
    assert(tr.stdOutContained("Path doesn't exist"), "should have printed: Path doesn't exis");
    assert(tr.stdOutContained("ExtractionFailed"), "should have printed: ExtractionFailed");

    done();
  }).timeout(20000);

  it('test resolve platform', (done: Mocha.Done) => {
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

  // it('should handle invalid zip file paths gracefully', async () => {
  //   const invalidZipPath = '/path/to/nonexistent.zip';
  //   await expect(unzipRelease(invalidZipPath)).rejects.toThrow();
  //   // Add additional assertions if needed
  // });

  // Add more test cases as needed to cover different scenarios

});