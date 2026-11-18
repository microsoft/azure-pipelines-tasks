import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { execFileSync } from 'child_process';
import { BuildArtifact } from '../../DownloadEngine/build/buildClient';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { IntegrityError } from '../../DownloadEngine/errors';
import { FileContainerProvider } from '../../DownloadEngine/providers/fileContainerProvider';
import { ArtifactDownloadParameters, ProviderContext } from '../../DownloadEngine/providers/types';
import { chunkIdOf } from '../../DownloadEngine/dedup/hashing';
import { consoleLogger } from '../../DownloadEngine/util/logger';
import { UnsafePathError } from '../../DownloadEngine/util/paths';
import { NodeBuilder } from './artifactWriter';
import { FakeContainerService } from './fakeContainerService';
import { seeded } from './testUtil';

const workRoot = path.join(os.tmpdir(), `dba-container-${process.pid}`);

function workDir(name: string): string {
    const root = path.join(workRoot, name);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    return root;
}

function params(targetDirectory: string, patterns: string[] = ['**']): ArtifactDownloadParameters {
    return {
        project: 'project',
        pipelineId: 1,
        targetDirectory,
        minimatchFilters: patterns,
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: true,
        parallelizationLimit: 4,
        retryDownloadCount: 2,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: false
    };
}

function artifact(name: string, data: string): BuildArtifact {
    return { name, resource: { type: 'Container', data } };
}

describe('FileContainerProvider', function () {
    this.timeout(60000);
    let service: FakeContainerService;
    let http: HttpClient;
    let context: ProviderContext;

    beforeEach(async () => {
        service = new FakeContainerService();
        await service.start();
        http = new HttpClient({ authorization: () => 'Bearer test', allowInsecureLoopback: true, logger: consoleLogger });
        context = { http, collectionUri: service.baseUrl + '/', logger: consoleLogger };
    });

    afterEach(async () => {
        http.close();
        await service.stop();
        fs.rmSync(workRoot, { recursive: true, force: true });
    });

    it('downloads, filters, and keeps the artifact name in the destination path', async () => {
        service.setContainer(7, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/docs', itemType: 'folder' },
            { path: 'drop/readme.txt', itemType: 'file', fileLength: 6, contentLocation: service.addContent('readme', 'hello\n') },
            { path: 'drop/docs/a.txt', itemType: 'file', fileLength: 3, contentLocation: service.addContent('a', 'aaa') },
            { path: 'drop/docs/skip.log', itemType: 'file', fileLength: 4, contentLocation: service.addContent('skip', 'skip') }
        ]);

        const target = workDir('container-filter');
        await new FileContainerProvider(context).downloadSingleArtifact(params(target, ['drop/**', '!drop/**/*.log']), artifact('drop', '#/7/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'readme.txt'), 'utf8'), 'hello\n');
        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'docs', 'a.txt'), 'utf8'), 'aaa');
        assert.ok(!fs.existsSync(path.join(target, 'drop', 'docs', 'skip.log')));
    });

    it('retries transient container content failures', async () => {
        let first = true;
        service.fault = request => {
            if (first && request.method === 'GET' && request.path.includes('/container-content/retry')) {
                first = false;
                return 503;
            }
            return undefined;
        };
        service.setContainer(8, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/retry.txt', itemType: 'file', fileLength: 5, contentLocation: service.addContent('retry', 'retry') }
        ]);

        const target = workDir('container-retry');
        await new FileContainerProvider(context).downloadSingleArtifact(params(target), artifact('drop', '#/8/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'retry.txt'), 'utf8'), 'retry');
        assert.ok(service.countRequests('GET', '/container-content/retry') >= 2);
    });

    it('downloads blob backed items from the dedup store', async () => {
        const metadata = service.addDedupBlob(Buffer.from('blob-backed', 'utf8'));
        service.setContainer(9, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/blob.txt', itemType: 'file', fileLength: 11, blobMetadata: metadata }
        ]);

        const target = workDir('container-blob');
        await new FileContainerProvider(context).downloadSingleArtifact(params(target), artifact('drop', '#/9/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'blob.txt'), 'utf8'), 'blob-backed');
    });

    it('fails when the size check finds a truncated file', async () => {
        service.setContainer(10, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/file.txt', itemType: 'file', fileLength: 99, contentLocation: service.addContent('short', 'short') }
        ]);

        const target = workDir('container-size');
        await assert.rejects(
            () => new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), checkDownloadedFiles: true }, artifact('drop', '#/10/drop')),
            error => error instanceof IntegrityError && /integrity check failed/i.test(error.message)
        );
    });

    it('extracts tar archives when requested', async function () {
        if (process.platform === 'win32') {
            this.skip();
            return;
        }

        const archiveRoot = workDir('archive-src');
        fs.mkdirSync(path.join(archiveRoot, 'bin'), { recursive: true });
        fs.writeFileSync(path.join(archiveRoot, 'bin', 'tool.sh'), '#!/bin/sh\necho ok\n');
        const archivePath = path.join(workDir('archive-file'), 'drop.tar');
        await new Promise<void>((resolve, reject) => {
            const child = require('child_process').execFile('tar', ['cf', archivePath, '-C', archiveRoot, 'bin'], (error: Error | null) => error ? reject(error) : resolve());
            child.on('error', reject);
        });

        service.setContainer(11, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/drop.tar', itemType: 'file', fileLength: fs.statSync(archivePath).size, contentLocation: service.addContent('tar', fs.readFileSync(archivePath)) }
        ]);

        const target = workDir('container-tar');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), extractTars: true, extractedTarsTempPath: path.join(target, '_tar-temp') }, artifact('drop', '#/11/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'extracted_tars', 'drop', 'bin', 'tool.sh'), 'utf8'), '#!/bin/sh\necho ok\n');
        assert.ok(!fs.existsSync(path.join(target, 'drop', 'drop.tar')));
    });

    it('extracts tar archives when the temporary folder is on another file system than the destination', async function () {
        if (process.platform === 'win32') {
            this.skip();
            return;
        }

        const archiveRoot = workDir('archive-src-device');
        fs.mkdirSync(path.join(archiveRoot, 'bin'), { recursive: true });
        fs.writeFileSync(path.join(archiveRoot, 'bin', 'tool.sh'), '#!/bin/sh\necho ok\n');
        fs.chmodSync(path.join(archiveRoot, 'bin', 'tool.sh'), 0o755);
        fs.symlinkSync('tool.sh', path.join(archiveRoot, 'bin', 'tool-link'));
        const archivePath = path.join(workDir('archive-file-device'), 'drop.tar');
        execFileSync('tar', ['cf', archivePath, '-C', archiveRoot, 'bin']);

        service.setContainer(13, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/drop.tar', itemType: 'file', fileLength: fs.statSync(archivePath).size, contentLocation: service.addContent('tar-device', fs.readFileSync(archivePath)) }
        ]);

        const target = workDir('container-tar-device');
        const temporary = path.join(workDir('container-tar-device-temp'), 'extracted_tars');
        const promises = fs.promises as unknown as { rename: (from: string, to: string) => Promise<void> };
        const originalRename = promises.rename;
        // A rename out of the temporary folder fails as it does between two file systems, for example between the temp folder of the agent
        // and a folder that exists only inside a job container.
        promises.rename = async (from, to) => {
            if (from.startsWith(temporary)) {
                throw Object.assign(new Error(`EXDEV: cross-device link not permitted, rename '${from}' -> '${to}'`), { code: 'EXDEV' });
            }
            return originalRename(from, to);
        };
        try {
            await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), extractTars: true, extractedTarsTempPath: temporary }, artifact('drop', '#/13/drop'));
        } finally {
            promises.rename = originalRename;
        }

        const extracted = path.join(target, 'extracted_tars', 'drop', 'bin');
        assert.strictEqual(fs.readFileSync(path.join(extracted, 'tool.sh'), 'utf8'), '#!/bin/sh\necho ok\n');
        assert.strictEqual(fs.statSync(path.join(extracted, 'tool.sh')).mode & 0o777, 0o755);
        assert.strictEqual(fs.readlinkSync(path.join(extracted, 'tool-link')), 'tool.sh');
        assert.ok(!fs.existsSync(path.join(temporary, 'drop', 'bin', 'tool.sh')));
    });

    it('only treats files with a lower case .tar extension as archives, like the agent plugin', async () => {
        service.setContainer(12, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/UPPER.TAR', itemType: 'file', fileLength: 4, contentLocation: service.addContent('upper', 'data') }
        ]);

        const target = workDir('container-tar-upper');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), extractTars: true, extractedTarsTempPath: path.join(target, '_tar-temp') }, artifact('drop', '#/12/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'UPPER.TAR'), 'utf8'), 'data');
        assert.ok(!fs.existsSync(path.join(target, 'extracted_tars')));
    });

    describe('tar archives that hold symbolic links', function () {
        before(function () {
            if (process.platform === 'win32') {
                this.skip();
            }
        });

        function addArchive(containerId: number, name: string, build: (source: string) => void): void {
            const source = workDir(`${name}-source`);
            build(source);
            const archivePath = path.join(workDir(`${name}-archive`), 'drop.tar');
            execFileSync('tar', ['cf', archivePath, '-C', source, '.']);
            const archive = fs.readFileSync(archivePath);
            service.setContainer(containerId, [
                { path: 'drop', itemType: 'folder' },
                { path: 'drop/drop.tar', itemType: 'file', fileLength: archive.length, contentLocation: service.addContent(`tar-${containerId}`, archive) }
            ]);
        }

        function extractionOf(target: string, validateTarSymlinks: boolean): ArtifactDownloadParameters {
            return { ...params(target), extractTars: true, validateTarSymlinks, extractedTarsTempPath: path.join(target, '_tar-temp') };
        }

        it('extracts a link that points outside of its folder when the validation is off, like the agent plugin', async () => {
            const outside = workDir('links-off-outside');
            addArchive(21, 'links-off', source => {
                fs.writeFileSync(path.join(source, 'file.txt'), 'file');
                fs.symlinkSync(outside, path.join(source, 'escape'));
            });

            const target = workDir('links-off');
            await new FileContainerProvider(context).downloadSingleArtifact(extractionOf(target, false), artifact('drop', '#/21/drop'));

            assert.ok(fs.lstatSync(path.join(target, 'extracted_tars', 'drop', 'escape')).isSymbolicLink());
        });

        it('rejects an archive with a link that points outside of its folder when the validation is on, and leaves nothing behind', async () => {
            const outside = workDir('links-on-outside');
            addArchive(22, 'links-on', source => {
                fs.writeFileSync(path.join(source, 'file.txt'), 'file');
                fs.symlinkSync(outside, path.join(source, 'escape'));
            });

            const target = workDir('links-on');
            await assert.rejects(
                () => new FileContainerProvider(context).downloadSingleArtifact(extractionOf(target, true), artifact('drop', '#/22/drop')),
                (error: Error) => error instanceof UnsafePathError && /points outside of its folder/.test(error.message));

            assert.ok(!fs.existsSync(path.join(target, 'drop', 'drop.tar')), 'the archive is removed');
            assert.ok(!fs.existsSync(path.join(target, '_tar-temp')), 'the extracted files are removed');
            assert.ok(!fs.existsSync(path.join(target, 'extracted_tars')));
        });

        it('accepts links that stay inside of their folder when the validation is on', async () => {
            addArchive(23, 'links-inside', source => {
                fs.mkdirSync(path.join(source, 'real'));
                fs.writeFileSync(path.join(source, 'real', 'file.txt'), 'file');
                fs.symlinkSync(path.join('real', 'file.txt'), path.join(source, 'alias'));
            });

            const target = workDir('links-inside');
            await new FileContainerProvider(context).downloadSingleArtifact(extractionOf(target, true), artifact('drop', '#/23/drop'));

            assert.strictEqual(fs.readFileSync(path.join(target, 'extracted_tars', 'drop', 'alias'), 'utf8'), 'file');
        });

        it('checks the archives of all artifacts too', async () => {
            const outside = workDir('links-all-outside');
            addArchive(24, 'links-all', source => fs.symlinkSync(outside, path.join(source, 'escape')));

            const target = workDir('links-all');
            await assert.rejects(
                () => new FileContainerProvider(context).downloadMultipleArtifacts(extractionOf(target, true), [artifact('drop', '#/24/drop')]),
                UnsafePathError);
        });
    });

    it('decodes the content encoding of the container service, which compresses whether it is asked to or not', async () => {
        const text = 'compressible text\n'.repeat(500);
        service.setContainer(13, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/gzip.txt', itemType: 'file', fileLength: text.length, contentLocation: service.addContent('gzip', zlib.gzipSync(Buffer.from(text)), 'text/plain', 'gzip') },
            { path: 'drop/deflate.txt', itemType: 'file', fileLength: text.length, contentLocation: service.addContent('deflate', zlib.deflateSync(Buffer.from(text)), 'text/plain', 'deflate') },
            { path: 'drop/plain.txt', itemType: 'file', fileLength: 5, contentLocation: service.addContent('plain', 'plain') },
            { path: 'drop/binary.gz', itemType: 'file', fileLength: 4, contentLocation: service.addContent('binary', Buffer.from([0x1f, 0x8b, 1, 2]), 'application/gzip') }
        ]);

        const target = workDir('container-encoding');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), checkDownloadedFiles: true }, artifact('drop', '#/13/drop'));

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'gzip.txt'), 'utf8'), text);
        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'deflate.txt'), 'utf8'), text);
        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'plain.txt'), 'utf8'), 'plain');
        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'binary.gz')), Buffer.from([0x1f, 0x8b, 1, 2]));
    });

    it('decompresses GZip blob backed items while it reads them, for one chunk and for many', async () => {
        const small = Buffer.from('small gzip blob\n'.repeat(20));
        const large = seeded('gzip-large', 300 * 1024);
        const compressed = zlib.gzipSync(large);
        const parts = [compressed.subarray(0, 100000), compressed.subarray(100000, 200000), compressed.subarray(200000)];
        const refs = parts.map(part => {
            const id = chunkIdOf(part);
            service.blob.chunks.set(id, Buffer.from(part));
            return { id, size: part.length };
        });
        const builder = new NodeBuilder();
        const root = builder.node(refs);
        service.blob.nodes.set(root.id, builder.nodes.get(root.id)!.data);

        service.setContainer(14, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/small.txt', itemType: 'file', fileLength: small.length, blobMetadata: service.addDedupBlob(zlib.gzipSync(small), 'GZip') },
            { path: 'drop/large.bin', itemType: 'file', fileLength: large.length, blobMetadata: { artifactHash: root.id, compressionType: 'GZip' } }
        ]);

        const target = workDir('container-gzip-blob');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), checkDownloadedFiles: true }, artifact('drop', '#/14/drop'));

        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'small.txt')), small);
        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'large.bin')), large);
        assert.strictEqual(service.countRequests('GET', '/container-content/'), 0, 'the blob store was used');
    });

    it('reads the chunks of a GZip blob backed item ahead and still decompresses them in order', async () => {
        const large = seeded('gzip-many-chunks', 2 * 1024 * 1024);
        const compressed = zlib.gzipSync(large);
        const partSize = Math.ceil(compressed.length / 100);
        const refs: Array<{ id: string; size: number }> = [];
        for (let offset = 0; offset < compressed.length; offset += partSize) {
            const part = compressed.subarray(offset, offset + partSize);
            const id = chunkIdOf(part);
            service.blob.chunks.set(id, Buffer.from(part));
            refs.push({ id, size: part.length });
        }
        assert.ok(refs.length > 64, `${refs.length} chunks`);
        const builder = new NodeBuilder();
        const root = builder.node(refs);
        service.blob.nodes.set(root.id, builder.nodes.get(root.id)!.data);

        service.setContainer(15, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/many.bin', itemType: 'file', fileLength: large.length, blobMetadata: { artifactHash: root.id, compressionType: 'GZip' } }
        ]);

        const target = workDir('container-gzip-many-chunks');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), checkDownloadedFiles: true }, artifact('drop', '#/15/drop'));

        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'many.bin')), large);
        assert.strictEqual(service.countRequests('GET', '/container-content/'), 0, 'the blob store was used');
    });

    it('asks for the blob URLs of many items in a few large calls', async () => {
        const files = Array.from({ length: 700 }, (_, index) => {
            const data = Buffer.from(`container file number ${index}\n`);
            return { name: `f${String(index).padStart(4, '0')}.txt`, data, blob: service.addDedupBlob(data) };
        });
        service.setContainer(16, [
            { path: 'drop', itemType: 'folder' },
            ...files.map(file => ({ path: `drop/${file.name}`, itemType: 'file' as const, fileLength: file.data.length, blobMetadata: file.blob }))
        ]);

        const target = workDir('container-many-blobs');
        await new FileContainerProvider(context).downloadSingleArtifact({ ...params(target), checkDownloadedFiles: true }, artifact('drop', '#/16/drop'));

        for (const file of [files[0], files[349], files[699]]) {
            assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', file.name)), file.data);
        }
        assert.strictEqual(service.countRequests('GET', '/container-content/'), 0, 'the blob store was used');
        const urlCalls = service.blob.countRequests('POST', '/_apis/dedup/urls');
        assert.ok(urlCalls >= 1 && urlCalls <= 3, `${urlCalls} calls for 700 items`);
    });

    it('falls back to the container service once, and says so, when the blob store cannot be reached', async () => {
        const data = Buffer.from('content that is also in the container service\n');
        service.setContainer(17, [
            { path: 'drop', itemType: 'folder' },
            { path: 'drop/a.txt', itemType: 'file', fileLength: data.length, contentLocation: service.addContent('fallback-a', data), blobMetadata: service.addDedupBlob(data) },
            { path: 'drop/b.txt', itemType: 'file', fileLength: data.length, contentLocation: service.addContent('fallback-b', data), blobMetadata: service.addDedupBlob(data) }
        ]);
        service.fault = request => request.path.includes('/vsblob/') ? 403 : undefined;

        const warnings: string[] = [];
        const noisy: ProviderContext = { ...context, logger: { ...consoleLogger, warning: message => { warnings.push(message); } } };
        const target = workDir('container-blob-unreachable');
        await new FileContainerProvider(noisy).downloadSingleArtifact(params(target), artifact('drop', '#/17/drop'));

        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'a.txt')), data);
        assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', 'b.txt')), data);
        assert.strictEqual(warnings.filter(message => /falling back to TFS/.test(message)).length, 1);
        assert.strictEqual(service.countRequests('GET', '/container-content/'), 2);
    });

    it('falls back for every file that was using the blob store when it failed, although no retries are left to make', async () => {
        const files = Array.from({ length: 12 }, (_, index) => {
            const data = Buffer.from(`content number ${index}, which the container service has as well\n`);
            return { name: `f${index}.txt`, data };
        });
        service.setContainer(18, [
            { path: 'drop', itemType: 'folder' },
            ...files.map(file => ({ path: `drop/${file.name}`, itemType: 'file' as const, fileLength: file.data.length, contentLocation: service.addContent(`in-flight-${file.name}`, file.data), blobMetadata: service.addDedupBlob(file.data) }))
        ]);
        // The settings of the blob store are fine and every file starts with it; then it refuses the calls for the URLs.
        service.fault = request => request.path.endsWith('/_apis/dedup/urls') ? 400 : undefined;

        const warnings: string[] = [];
        const noisy: ProviderContext = { ...context, logger: { ...consoleLogger, warning: message => { warnings.push(message); } } };
        const target = workDir('container-blob-fails-in-flight');
        await new FileContainerProvider(noisy).downloadSingleArtifact({ ...params(target), parallelizationLimit: 12, retryDownloadCount: 0 }, artifact('drop', '#/18/drop'));

        for (const file of files) {
            assert.deepStrictEqual(fs.readFileSync(path.join(target, 'drop', file.name)), file.data);
        }
        assert.strictEqual(warnings.filter(message => /falling back to TFS/.test(message)).length, 1);
        assert.strictEqual(service.countRequests('GET', '/container-content/'), 12);
    });

    it('creates nothing outside of the destination for an artifact name that leads out of it', async () => {
        const target = workDir('container-name');
        const before = fs.readdirSync(path.dirname(target));
        for (const name of ['..', '../outside', 'x/../..']) {
            await assert.rejects(
                () => new FileContainerProvider(context).downloadMultipleArtifacts({ ...params(target), appendArtifactNameToTargetPath: true }, [artifact(name, `#/30/${name}`)]),
                UnsafePathError,
                `the name "${name}"`);
        }
        assert.deepStrictEqual(fs.readdirSync(path.dirname(target)), before);
        assert.deepStrictEqual(fs.readdirSync(target), []);
    });
});
