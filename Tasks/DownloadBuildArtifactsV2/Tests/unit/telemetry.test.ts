import * as assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { AddressInfo } from 'net';
import { BuildArtifact, BuildClient } from '../../DownloadEngine/build/buildClient';
import { closeSharedWorkerPool } from '../../DownloadEngine/dedup/blobWorkerPool';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { FileContainerProvider } from '../../DownloadEngine/providers/fileContainerProvider';
import { FileShareProvider } from '../../DownloadEngine/providers/fileShareProvider';
import { PipelineArtifactProvider } from '../../DownloadEngine/providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters, ProviderContext } from '../../DownloadEngine/providers/types';
import { nullLogger } from '../../DownloadEngine/util/logger';
import { Telemetry, telemetry } from '../../DownloadEngine/util/telemetry';
import { addFolderArtifact } from './artifactWriter';
import { FakeContainerService } from './fakeContainerService';
import { FakeService } from './fakeService';

const workRoot = path.join(os.tmpdir(), `dba-telemetry-${process.pid}`);

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

describe('telemetry', function () {
    this.timeout(60000);

    beforeEach(() => telemetry.reset());
    afterEach(async () => {
        telemetry.reset();
        // The providers share one pool of worker threads, which the next test file must not find open.
        await closeSharedWorkerPool();
        fs.rmSync(workRoot, { recursive: true, force: true });
    });

    describe('the counters', () => {
        it('count, record a value and start over', () => {
            const counters = new Telemetry();
            counters.add('retries');
            counters.add('retries', 2);
            counters.add('bytes', 1024);
            counters.set('workerThreads', 3);
            counters.set('workerThreads', 2);
            assert.deepStrictEqual(counters.snapshot(), { retries: 3, bytes: 1024, workerThreads: 2 });
            counters.reset();
            assert.deepStrictEqual(counters.snapshot(), {});
        });

        it('hand out a copy, which later counts do not change', () => {
            const counters = new Telemetry();
            counters.add('files');
            const before = counters.snapshot();
            counters.add('files');
            assert.deepStrictEqual(before, { files: 1 });
            assert.deepStrictEqual(counters.snapshot(), { files: 2 });
        });
    });

    describe('the HTTP client', () => {
        let server: http.Server;
        let port: number;
        let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

        beforeEach(async () => {
            server = http.createServer((req, res) => handler(req, res));
            await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
            port = (server.address() as AddressInfo).port;
        });

        afterEach(async () => {
            server.closeAllConnections?.();
            await new Promise<void>(resolve => server.close(() => resolve()));
        });

        const client = () => new HttpClient({ allowInsecureLoopback: true, authorization: () => '******' });

        it('counts the responses that ask to wait, and the requests that are repeated', async () => {
            let calls = 0;
            handler = (_req, res) => {
                calls++;
                if (calls < 3) {
                    res.statusCode = calls === 1 ? 503 : 429;
                    res.setHeader('Retry-After', '0');
                    res.end('busy');
                } else {
                    res.end('ok');
                }
            };
            await client().request(`http://127.0.0.1:${port}/x`, { retries: 3 });
            assert.deepStrictEqual(telemetry.snapshot(), { throttled: 2, httpRetries: 2 });
        });

        it('counts a repeated request that was not throttled as a retry only', async () => {
            let calls = 0;
            handler = (_req, res) => {
                calls++;
                if (calls === 1) {
                    res.statusCode = 500;
                    res.end('broken');
                } else {
                    res.end('ok');
                }
            };
            await client().request(`http://127.0.0.1:${port}/x`, { retries: 3 });
            assert.deepStrictEqual(telemetry.snapshot(), { httpRetries: 1 });
        });

        it('counts nothing for a request that works, or for an error that is not repeated', async () => {
            handler = (_req, res) => res.end('ok');
            await client().request(`http://127.0.0.1:${port}/x`, { retries: 3 });
            handler = (_req, res) => { res.statusCode = 404; res.end('missing'); };
            await assert.rejects(() => client().request(`http://127.0.0.1:${port}/y`, { retries: 3 }));
            assert.deepStrictEqual(telemetry.snapshot(), {});
        });
    });

    describe('the providers', () => {
        let service: FakeContainerService;
        let client: HttpClient;
        let context: ProviderContext;

        beforeEach(async () => {
            service = new FakeContainerService();
            await service.start();
            client = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true });
            context = { http: client, collectionUri: service.baseUrl + '/', logger: nullLogger };
        });

        afterEach(async () => {
            client.close();
            await service.stop();
        });

        it('count the files that the container service sends, with their size', async () => {
            service.setContainer(40, [
                { path: 'drop', itemType: 'folder' },
                { path: 'drop/a.txt', itemType: 'file', fileLength: 5, contentLocation: service.addContent('t-a', 'aaaaa') },
                { path: 'drop/b.txt', itemType: 'file', fileLength: 7, contentLocation: service.addContent('t-b', 'bbbbbbb') }
            ]);
            await new FileContainerProvider(context).downloadSingleArtifact(params(workDir('container')), artifact('drop', '#/40/drop'));
            assert.deepStrictEqual(telemetry.snapshot(), { containerArtifacts: 1, files: 2, bytes: 12, containerFiles: 2 });
        });

        it('count the files that come from the blob store, and not those that a pattern leaves out', async () => {
            service.setContainer(41, [
                { path: 'drop', itemType: 'folder' },
                { path: 'drop/blob.txt', itemType: 'file', fileLength: 11, blobMetadata: service.addDedupBlob(Buffer.from('blob-backed')) },
                { path: 'drop/skip.log', itemType: 'file', fileLength: 4, blobMetadata: service.addDedupBlob(Buffer.from('skip')) }
            ]);
            await new FileContainerProvider(context).downloadSingleArtifact(params(workDir('blob'), ['drop/**', '!drop/**/*.log']), artifact('drop', '#/41/drop'));
            assert.deepStrictEqual(telemetry.snapshot(), { containerArtifacts: 1, files: 1, bytes: 11, blobFiles: 1 });
        });

        it('count the fall back to the container service when the blob store cannot be used', async () => {
            const data = Buffer.from('content that is also in the container service\n');
            service.setContainer(42, [
                { path: 'drop', itemType: 'folder' },
                { path: 'drop/a.txt', itemType: 'file', fileLength: data.length, contentLocation: service.addContent('tf-a', data), blobMetadata: service.addDedupBlob(data) },
                { path: 'drop/b.txt', itemType: 'file', fileLength: data.length, contentLocation: service.addContent('tf-b', data), blobMetadata: service.addDedupBlob(data) }
            ]);
            service.fault = request => request.path.includes('/vsblob/') ? 403 : undefined;
            await new FileContainerProvider(context).downloadSingleArtifact(params(workDir('fallback')), artifact('drop', '#/42/drop'));
            const counted = telemetry.snapshot();
            assert.strictEqual(counted.blobStoreFallbacks, 1);
            assert.strictEqual(counted.containerFiles, 2);
            assert.strictEqual(counted.blobFiles, undefined);
            assert.strictEqual(counted.files, 2);
        });

        it('count the files of a file share artifact', async () => {
            const share = workDir('share');
            const source = path.join(share, 'drop');
            fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
            fs.writeFileSync(path.join(source, 'docs', 'keep.txt'), 'keep');
            fs.writeFileSync(path.join(source, 'docs', 'skip.log'), 'skip it');
            fs.writeFileSync(path.join(source, 'root.txt'), 'root');
            await new FileShareProvider(context).downloadSingleArtifact(params(workDir('share-target'), ['drop/**', '!drop/**/*.log']), { name: 'drop', resource: { type: 'FilePath', data: share } });
            assert.deepStrictEqual(telemetry.snapshot(), { fileShareArtifacts: 1, files: 2, bytes: 8 });
        });
    });

    describe('a pipeline artifact', () => {
        it('is counted with its files and bytes, as the download reports them', async () => {
            const blobService = new FakeService();
            await blobService.start();
            const client = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true });
            const source = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-telemetry-src-'));
            const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-telemetry-dst-'));
            try {
                fs.mkdirSync(path.join(source, 'b'), { recursive: true });
                fs.writeFileSync(path.join(source, 'a.txt'), 'hello');
                fs.writeFileSync(path.join(source, 'b', 'c.txt'), '1234567');
                fs.writeFileSync(path.join(source, 'empty.dat'), '');
                addFolderArtifact(blobService, { projectId: 'p-1', buildId: 7, artifactName: 'drop', sourcePath: source });
                const added = await new BuildClient(client, blobService.baseUrl + '/').getArtifact('p-1', 7, 'drop');

                telemetry.reset();
                await new PipelineArtifactProvider({ http: client, collectionUri: blobService.baseUrl + '/', logger: nullLogger }).downloadSingleArtifact(params(target), added);
                assert.deepStrictEqual(telemetry.snapshot(), { pipelineArtifacts: 1, files: 3, bytes: 12 });
            } finally {
                client.close();
                await blobService.stop();
                fs.rmSync(source, { recursive: true, force: true });
                fs.rmSync(target, { recursive: true, force: true });
            }
        });
    });
});
