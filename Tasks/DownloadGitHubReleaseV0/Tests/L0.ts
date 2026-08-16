import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as models from 'artifact-engine/Models';
import { getPaginatedArtifactItems } from '../githubReleaseProvider';
import { sanitizeForLoggingCommand } from '../sanitize';

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

  it('Gets release assets from every page', async () => {
    const rootItem = createRootItem();
    const pageLengths = [100, 35];
    const requestedUrls: string[] = [];

    const items = await getPaginatedArtifactItems(rootItem, async pageItem => {
      requestedUrls.push(pageItem.metadata.downloadUrl);
      return createItems(pageLengths[requestedUrls.length - 1]);
    });

    assert.strictEqual(items.length, 135);
    assert.deepStrictEqual(requestedUrls, [
      'https://api.github.com/repos/userOrg/repoName/releases/1/assets?per_page=100&page=1',
      'https://api.github.com/repos/userOrg/repoName/releases/1/assets?per_page=100&page=2'
    ]);
  });

  it('Gets single-page release assets once', async () => {
    const rootItem = createRootItem();
    let requestCount = 0;

    const items = await getPaginatedArtifactItems(rootItem, async () => {
      requestCount++;
      return createItems(2);
    });

    assert.strictEqual(items.length, 2);
    assert.strictEqual(requestCount, 1);
  });

  it('Stops pagination after an empty page', async () => {
    const rootItem = createRootItem();
    const pageLengths = [100, 0];
    let requestCount = 0;

    const items = await getPaginatedArtifactItems(rootItem, async () => {
      return createItems(pageLengths[requestCount++]);
    });

    assert.strictEqual(items.length, 100);
    assert.strictEqual(requestCount, 2);
  });

  it('Propagates pagination errors for ArtifactEngine retry handling', async () => {
    const rootItem = createRootItem();
    const expectedError = new Error('GitHub request failed');
    let requestCount = 0;

    await assert.rejects(
      getPaginatedArtifactItems(rootItem, async () => {
        requestCount++;
        if (requestCount === 2) {
          throw expectedError;
        }
        return createItems(100);
      }),
      expectedError
    );
    assert.strictEqual(requestCount, 2);
  });

  it('Release name containing a logging command should be neutralized', async () => {
    const tp: string = path.join(__dirname, 'L0GetSpecificReleaseWithMaliciousName.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    try {
        await tr.runAsync();
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('##vso[task.setvariable variable=injected'), 'injected logging command should not be emitted');
        assert(tr.stdOutContained('__vso[task.setvariable variable=injected'), 'injected logging command should be escaped');

    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(20000);
});

// Unit tests for sanitizeForLoggingCommand (MSRC 125108 - prevent ##vso[ command injection)
describe('sanitizeForLoggingCommand', function () {
    it('should return normal release names unchanged', () => {
        assert.strictEqual(sanitizeForLoggingCommand('v1.0.0'), 'v1.0.0');
        assert.strictEqual(sanitizeForLoggingCommand('Release 2026-07 (GA)'), 'Release 2026-07 (GA)');
    });

    it('should strip ##vso[ patterns', () => {
        const malicious = 'v1.0.0 ##vso[task.setvariable variable=x;isoutput=true]pwned';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
        assert(sanitized.indexOf('__vso[') !== -1, 'should replace with __vso[');
    });

    it('should strip ##vso[ case-insensitively', () => {
        const sanitized = sanitizeForLoggingCommand('v1.0.0 ##VSO[task.setendpoint id=SystemVssConnection;field=url]http://evil');
        assert(sanitized.indexOf('##VSO[') === -1, 'should not contain ##VSO[');
    });

    it('should strip ##[ logging command patterns', () => {
        const sanitized = sanitizeForLoggingCommand('v1.0.0 ##[section]Injected section');
        assert(sanitized.indexOf('##[') === -1, 'should not contain ##[');
        assert(sanitized.indexOf('__[') !== -1, 'should replace with __[');
    });

    it('should replace newlines to prevent line-splitting injection', () => {
        const sanitized = sanitizeForLoggingCommand('v1.0.0\n##vso[task.prependpath]/tmp/evil');
        assert(sanitized.indexOf('\n') === -1, 'should not contain newlines');
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
    });

    it('should replace carriage return + newline sequences', () => {
        const sanitized = sanitizeForLoggingCommand('v1.0.0\r\n##vso[task.complete result=Failed]');
        assert(sanitized.indexOf('\r') === -1, 'should not contain CR');
        assert(sanitized.indexOf('\n') === -1, 'should not contain LF');
    });

    it('should handle null, undefined and empty strings', () => {
        assert.strictEqual(sanitizeForLoggingCommand(null), null);
        assert.strictEqual(sanitizeForLoggingCommand(undefined), undefined);
        assert.strictEqual(sanitizeForLoggingCommand(''), '');
    });

    it('should handle multiple injections in one string', () => {
        const sanitized = sanitizeForLoggingCommand('##vso[task.setvariable variable=A]x ##vso[task.setvariable variable=B]y');
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain any ##vso[');
    });
});

// Untrusted GitHub data also reaches stdout through artifact-engine (asset names, raw
// response bodies), which this task cannot sanitize itself. The restrictions block is the
// control covering those sinks, so guard it against accidental removal.
describe('DownloadGitHubReleaseV0 task.json restrictions', function () {
    const taskJson = require('../task.json');

    it('should run logging commands in restricted mode', () => {
        assert(taskJson.restrictions, 'task.json should declare restrictions');
        assert.strictEqual(taskJson.restrictions.commands.mode, 'restricted');
    });

    it('should not allow the task to set any variables', () => {
        assert.deepStrictEqual(taskJson.restrictions.settableVariables.allowed, []);
    });
});

function createRootItem(): models.ArtifactItem {
  const item = new models.ArtifactItem();
  item.path = '';
  item.metadata = {
    downloadUrl: 'https://api.github.com/repos/userOrg/repoName/releases/1/assets'
  };
  return item;
}

function createItems(count: number): models.ArtifactItem[] {
  return Array.from({ length: count }, (_, index) => {
    const item = new models.ArtifactItem();
    item.path = `asset-${index}`;
    return item;
  });
}
