import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";

describe("DockerV2 BuildKit Detection Suite", function () {
  this.timeout(30000);

  beforeEach(() => {
    // Clean up environment before each test
    delete process.env['DOCKER_BUILDKIT'];
  });

  after(() => {
    delete process.env['DOCKER_BUILDKIT'];
  });

  it('Should not warn when DOCKER_BUILDKIT=1 and output is empty', async () => {
    const tp = path.join(__dirname, 'L0BuildKitDetectionTests', 'BuildKitEnabled.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();
    
    assert(tr.succeeded, 'task should have succeeded');
    assert(tr.warningIssues.length === 0, 'should have no warnings when BuildKit is explicitly enabled');
    assert(tr.stdout.indexOf('Empty output file') >= 0 || tr.stdout.indexOf('expected when using BuildKit') >= 0, 
      'should debug log that empty output is expected with BuildKit');
  });

  it('Should warn when DOCKER_BUILDKIT=0 and output is empty', async () => {
    const tp = path.join(__dirname, 'L0BuildKitDetectionTests', 'BuildKitDisabled.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();
    
    assert(tr.succeeded, 'task should have succeeded');
    assert(tr.warningIssues.length > 0, 'should have warnings when legacy builder is used with empty output');
    assert(tr.stdout.indexOf('NoDataWrittenOnFile') >= 0 || tr.warningIssues.some(w => w.indexOf('No data was written') >= 0), 
      'should warn about no data written with legacy builder');
  });

  it('Should not warn when DOCKER_BUILDKIT is unset (assumes modern Docker)', async () => {
    const tp = path.join(__dirname, 'L0BuildKitDetectionTests', 'BuildKitUnset.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();
    
    assert(tr.succeeded, 'task should have succeeded');
    assert(tr.warningIssues.length === 0, 'should have no warnings when DOCKER_BUILDKIT is unset (modern Docker default)');
    assert(tr.stdout.indexOf('assuming modern Docker') >= 0 || tr.stdout.indexOf('expected when using BuildKit') >= 0, 
      'should debug log assumption of modern Docker with BuildKit');
  });

  it('Should not warn when output has content regardless of BuildKit setting', async () => {
    const tp = path.join(__dirname, 'L0BuildKitDetectionTests', 'OutputWithContent.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();
    
    assert(tr.succeeded, 'task should have succeeded');
    assert(tr.warningIssues.length === 0, 'should have no warnings when output has content');
  });
});
