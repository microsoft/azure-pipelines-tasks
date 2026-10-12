import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { validateSymbolicLinks } from '../file_helper';

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
