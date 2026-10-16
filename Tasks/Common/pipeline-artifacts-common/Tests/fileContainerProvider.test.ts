import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { BuildArtifact } from '../src/build/buildClient';
import { HttpClient } from '../src/http/httpClient';
import { IntegrityError } from '../src/errors';
import { FileContainerProvider } from '../src/providers/fileContainerProvider';
import { ArtifactDownloadParameters, ProviderContext } from '../src/providers/types';
import { chunkIdOf } from '../src/dedup/hashing';
import { NodeBuilder } from '../src/dedup/nodes';
import { consoleLogger } from '../src/util/logger';
import { FakeContainerService } from './fakeContainerService';
import { seeded } from './testUtil';

function workDir(name: string): string {
    const root = path.join(process.cwd(), '_testwork', name);
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
        fs.rmSync(path.join(process.cwd(), '_testwork'), { recursive: true, force: true });
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
});
