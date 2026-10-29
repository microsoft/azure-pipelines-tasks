import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from 'azure-pipelines-task-lib/task';
import { validateSymbolicLinks, extractTarsIfPresent } from '../file_helper';
import { ArtifactEngineOptions } from 'artifact-engine/Engine';
import { TicketState } from 'artifact-engine/Models';
import { DownloadHandlerFilePath } from '../DownloadHandlers/DownloadHandlerFilePath';

describe('DownloadBuildArtifactsV0 flag-free artifact matching', function () {
    const matchingFlag = 'DISTRIBUTEDTASK_TASKS_CASEINSENSITIVEARTIFACTMATCHINGFIXENABLED';
    let originalFlag: string | undefined;
    let root: string;
    let source: string;
    let destination: string;

    before(() => tl.setResourcePath(path.join(__dirname, '..', 'task.json')));

    beforeEach(() => {
        originalFlag = process.env[matchingFlag];
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-matching-'));
        source = path.join(root, 'source');
        destination = path.join(root, 'destination');
        fs.mkdirSync(path.join(source, 'drop'), { recursive: true });
        fs.mkdirSync(destination);
        fs.writeFileSync(path.join(source, 'drop', 'Report.txt'), 'artifact contents');
        fs.writeFileSync(path.join(destination, 'CaseProbe'), '');
    });

    afterEach(() => {
        if (originalFlag === undefined) {
            delete process.env[matchingFlag];
        } else {
            process.env[matchingFlag] = originalFlag;
        }
        fs.rmSync(root, { recursive: true, force: true });
    });

    for (const flag of [undefined, 'false']) {
        for (const pattern of ['drop/Report.txt', 'DROP/REPORT.TXT']) {
            it(`applies filesystem-aware matching to ${pattern} with the flag ${flag === undefined ? 'absent' : 'disabled'}`, async function () {
                this.timeout(10000);
                if (flag === undefined) {
                    delete process.env[matchingFlag];
                } else {
                    process.env[matchingFlag] = flag;
                }

                const options = new ArtifactEngineOptions();
                options.itemPattern = pattern;
                options.parallelProcessingLimit = 1;
                options.retryLimit = 1;
                const handler = new DownloadHandlerFilePath({
                    artifactInfo: { name: 'drop', resource: { type: 'FilePath', data: source } },
                    downloadPath: destination,
                    downloaderOptions: options,
                    checkDownloadedFiles: true
                });

                const tickets = await handler.downloadResources();
                const caseInsensitive = process.platform === 'win32'
                    || (process.platform === 'darwin' && fs.existsSync(path.join(destination, 'caseprobe')));
                const shouldDownload = pattern === 'drop/Report.txt' || caseInsensitive;
                const fileTicket = tickets.find(ticket => ticket.artifactItem.path === path.join('drop', 'Report.txt'));
                assert.ok(fileTicket, 'the source file should have a download ticket');
                assert.strictEqual(fileTicket.state, shouldDownload ? TicketState.Processed : TicketState.Skipped);
                const downloadedFile = path.join(destination, 'drop', 'Report.txt');
                assert.strictEqual(fs.existsSync(downloadedFile), shouldDownload);
                if (shouldDownload) {
                    assert.strictEqual(fs.readFileSync(downloadedFile, 'utf8'), 'artifact contents');
                }
            });
        }
    }
});

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