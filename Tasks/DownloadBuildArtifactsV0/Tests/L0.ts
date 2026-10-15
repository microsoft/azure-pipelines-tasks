import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { validateSymbolicLinks, extractTarsIfPresent } from '../file_helper';

describe('DownloadBuildArtifactsV0 Suite', function () {
    let nodePath: string;

    before(async function () {
        this.timeout(120000);

        const setupRunner = new ttm.MockTestRunner(
            path.join(__dirname, 'L0NoBuildTypeProvidedFail.js')
        );
        await setupRunner.LoadAsync();
        nodePath = setupRunner.nodePath;
    });

    it('No build type provided should fail', async () => {
      const tp: string = path.join(__dirname, 'L0NoBuildTypeProvidedFail.js');
      const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
      tr.nodePath = nodePath;

      try {
          await tr.runAsync();
          assert(tr.stdOutContained('Input required: buildType'));
          assert(tr.failed, 'task should have failed');

      } catch (err) {
          console.log(tr.stdout);
          console.log(tr.stderr);
          console.log(err);
          throw err;
      };
  }).timeout(10000);
  
  it('No download path provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoDownloadPathProvidedFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    tr.nodePath = nodePath;

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
  }).timeout(5000);;

  it('No download type provided should fail', async () => {
    const tp: string = path.join(__dirname, 'L0NoDownloadTypeProvidedFail.js');
    const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    tr.nodePath = nodePath;

    try {
        await tr.runAsync();
        assert(tr.stdOutContained('Input required: downloadType'));
        assert(tr.failed, 'task should have failed');
    } catch (err) {
        console.log(tr.stdout);
        console.log(tr.stderr);
        console.log(err);
        throw err;
    };
  }).timeout(5000);;
});

describe('DownloadBuildArtifactsV0 symlink validation', function () {
    before(function () {
        if (process.platform === 'win32') {
            this.skip();
        }
    });

    let root: string;
    let outside: string;

    beforeEach(() => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-'));
        root = path.join(base, 'root');
        outside = path.join(base, 'outside');
        fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
        fs.mkdirSync(outside);
    });

    afterEach(() => fs.rmSync(path.dirname(root), { recursive: true, force: true }));

    it('allows regular files and folders without symlinks', () => {
        fs.writeFileSync(path.join(root, 'sub', 'f.txt'), 'x');
        validateSymbolicLinks(root, root);
    });

    it('allows links to a subfolder, a file and its own folder', () => {
        fs.writeFileSync(path.join(root, 'sub', 'f.txt'), 'x');
        fs.symlinkSync('sub', path.join(root, 'l1'));
        fs.symlinkSync('sub/f.txt', path.join(root, 'l2'));
        fs.symlinkSync('.', path.join(root, 'l3'));
        validateSymbolicLinks(root, root);
    });

    it('rejects a link pointing outside', () => {
        fs.symlinkSync('../outside', path.join(root, 'pivot'));
        assert.throws(() => validateSymbolicLinks(root, root));
    });

    it('rejects an outside link written with ".." tricks', () => {
        fs.symlinkSync('sub/../../outside', path.join(root, 'pivot'));
        assert.throws(() => validateSymbolicLinks(root, root));
    });

    it('rejects an absolute link pointing outside', () => {
        fs.symlinkSync(outside, path.join(root, 'abs'));
        assert.throws(() => validateSymbolicLinks(root, root));
    });

});

describe('DownloadBuildArtifactsV0 tar extraction directory', function () {
    let tempRoot: string;
    let tempDir: string;
    let stagingDir: string;
    let originalTempDir: string | undefined;
    let originalFlag: string | undefined;

    const ticketFor = (tarPath: string): any[][] => [[{ artifactItem: { itemType: 'file', path: tarPath } }]];

    beforeEach(() => {
        tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-tar-'));
        tempDir = path.join(tempRoot, '_temp');
        stagingDir = path.join(tempDir, 'extracted_tars');
        fs.mkdirSync(stagingDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'temp-marker.txt'), 'x');
        fs.writeFileSync(path.join(stagingDir, 'staging-marker.txt'), 'x');
        originalTempDir = process.env['AGENT_TEMPDIRECTORY'];
        process.env['AGENT_TEMPDIRECTORY'] = tempDir;
        originalFlag = process.env['DISTRIBUTEDTASK_TASKS_ENABLETARSYMLINKVALIDATION'];
        process.env['DISTRIBUTEDTASK_TASKS_ENABLETARSYMLINKVALIDATION'] = 'true';
    });

    afterEach(() => {
        if (originalTempDir === undefined) {
            delete process.env['AGENT_TEMPDIRECTORY'];
        } else {
            process.env['AGENT_TEMPDIRECTORY'] = originalTempDir;
        }
        if (originalFlag === undefined) {
            delete process.env['DISTRIBUTEDTASK_TASKS_ENABLETARSYMLINKVALIDATION'];
        } else {
            process.env['DISTRIBUTEDTASK_TASKS_ENABLETARSYMLINKVALIDATION'] = originalFlag;
        }
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    const nameError = /Invalid TAR archive name/;

    it('rejects ...tar and leaves the temp directory untouched', () => {
        assert.throws(() => extractTarsIfPresent(ticketFor('drop/...tar') as any, path.join(tempRoot, 'dl')), nameError);
        assert.ok(fs.existsSync(path.join(tempDir, 'temp-marker.txt')));
    });

    it('rejects .tar and leaves the staging directory untouched', () => {
        assert.throws(() => extractTarsIfPresent(ticketFor('drop/.tar') as any, path.join(tempRoot, 'dl')), nameError);
        assert.ok(fs.existsSync(path.join(stagingDir, 'staging-marker.txt')));
    });

    it('does not reject a valid name that starts with dots', () => {
        try {
            extractTarsIfPresent(ticketFor('drop/..foo.tar') as any, path.join(tempRoot, 'dl'));
        } catch (err) {
            assert.ok(!nameError.test(err.message), err.message);
        }
    });

    it('does not reject a normal archive name', () => {
        try {
            extractTarsIfPresent(ticketFor('drop/links.tar') as any, path.join(tempRoot, 'dl'));
        } catch (err) {
            assert.ok(!nameError.test(err.message), err.message);
        }
    });
});