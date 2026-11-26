import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import vm = require('vm');
import AdmZip = require('adm-zip');

import { findEntryOutsideRoot } from '../ZipEntryValidator';

describe('ZipEntryValidator', function () {
    const root = path.resolve('jenkinsArtifacts');

    it('accepts entries inside the target directory', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['archive/a/b.txt', 'archive/', 'archive/x/../y.txt']), undefined);
    });

    describe('Jenkins legacy ZIP extraction', function () {
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-zip-'));
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        function loadUnzip(skipValidation = false): (zip: string, destination: string) => Promise<void> {
            const taskExports: any = {};
            const mocks = {
                'azure-pipelines-task-lib/task': {
                    debug: () => undefined,
                    loc: (key: string, ...args: string[]) => [key, ...args].join(' '),
                    getPipelineFeature: (name: string) => {
                        assert.strictEqual(name, 'JenkinsDownloadArtifacts.DisableZipEntryValidation');
                        return skipValidation;
                    },
                    setResourcePath: () => undefined,
                    getInput: () => { throw new Error('Task entry point is not used by extraction tests'); },
                    getVariable: () => '',
                    error: () => undefined,
                    setResult: () => undefined,
                    TaskResult: { Failed: 2 }
                },
                'artifact-engine/Providers': {},
                'artifact-engine/Engine': {},
                'typed-rest-client/Handlers': {},
                './AzureStorageArtifacts/AzureStorageArtifactDownloader': {},
                './ArtifactDetails/ArtifactDetailsDownloader': {},
                './ArtifactDetails/JenkinsRestClient': {},
                './JenkinsOutput': { JenkinsOutput: { initialize: () => undefined } },
                './ZipEntryValidator': { findEntryOutsideRoot },
                './task.json': { version: {} },
                'fs-extra': {},
                uuid: {}
            };
            // Select the legacy branch without changing the suite's process or mocking the ZIP implementation.
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'jenkinsdownloadartifacts.js'), 'utf8'), {
                exports: taskExports,
                require: (name: string) => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : require(name),
                process: { versions: { node: '16.0.0' }, env: {} },
                console: { log: () => undefined },
                __dirname: path.join(__dirname, '..')
            });
            return taskExports.unzip;
        }

        function createArchive(entry = 'archive/hello.txt'): string {
            const archive = new AdmZip();
            archive.addFile(entry, Buffer.from('artifact contents'));
            const zip = path.join(root, 'artifacts.zip');
            archive.writeZip(zip);
            return zip;
        }

        for (const skipValidation of [false, true]) {
            it(`extracts a valid ZIP with validation ${skipValidation ? 'disabled' : 'enabled'}`, async () => {
                const destination = path.join(root, 'output');
                await loadUnzip(skipValidation)(createArchive(), destination);
                assert.strictEqual(fs.readFileSync(path.join(destination, 'archive', 'hello.txt'), 'utf8'), 'artifact contents');
            });
        }

        it('rejects an entry outside the destination before extracting', async () => {
            const destination = path.join(root, 'output');
            await assert.rejects(loadUnzip()(createArchive('../outside.txt'), destination), /ZipEntryOutsideTargetDirectory/);
            assert.strictEqual(fs.existsSync(path.join(root, 'outside.txt')), false);
            assert.strictEqual(fs.existsSync(destination), false);
        });

        it('rejects a malformed ZIP during listing', async () => {
            const zip = path.join(root, 'invalid.zip');
            fs.writeFileSync(zip, 'not a ZIP archive');
            await assert.rejects(loadUnzip()(zip, path.join(root, 'output')), /ExtractionFailed/);
        });

        it('propagates extraction errors after successful validation', async () => {
            const destination = path.join(root, 'output');
            fs.writeFileSync(destination, 'not a directory');
            await assert.rejects(loadUnzip()(createArchive(), destination), /ExtractionFailed/);
        });
    });

    it('rejects parent traversal entries', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['archive/a.txt', '../x']), '../x');
    });

    it('rejects sibling-prefix entries', () => {
        const entry = 'archive/../../jenkinsArtifacts-evil/payload';
        assert.strictEqual(findEntryOutsideRoot(root, [entry]), entry);
    });

    it('rejects backslash traversal entries', () => {
        const entry = 'archive\\..\\..\\jenkinsArtifacts-evil\\payload';
        assert.strictEqual(findEntryOutsideRoot(root, [entry]), entry);
    });

    it('rejects absolute entries', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['/etc/passwd']), '/etc/passwd');
        assert.strictEqual(findEntryOutsideRoot(root, ['C:\\temp\\x']), 'C:\\temp\\x');
    });
});
