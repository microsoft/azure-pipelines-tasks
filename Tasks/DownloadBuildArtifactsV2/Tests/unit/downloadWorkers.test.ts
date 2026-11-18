import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DedupTransport, discoverBlobStore } from '../../DownloadEngine/dedup/blobStore';
import { AbortedError } from '../../DownloadEngine/errors';
import { BlobReader } from '../../DownloadEngine/dedup/blobReader';
import { BlobWorkerPool } from '../../DownloadEngine/dedup/blobWorkerPool';
import { WorkerJob } from '../../DownloadEngine/dedup/blobWorkerProtocol';
import { downloadManifestArtifact, startWorkersFor, workerLimits } from '../../DownloadEngine/dedup/download';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { nullLogger } from '../../DownloadEngine/util/logger';
import { telemetry } from '../../DownloadEngine/util/telemetry';
import { addFolderArtifact } from './artifactWriter';
import { FakeService } from './fakeService';

interface PoolInternals {
    workers: Array<{ worker: { terminate(): Promise<number> }; pending: Map<number, unknown> }>;
}

function readTree(root: string, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            Object.assign(result, readTree(root, relative));
        } else {
            result[relative] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
        }
    }
    return result;
}

function writeTree(root: string, files: Record<string, Buffer>): void {
    for (const [relative, content] of Object.entries(files)) {
        const file = path.join(root, ...relative.split('/'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    }
}

function counted(pool: BlobWorkerPool): Record<WorkerJob['type'], number> {
    const counts = { chunk: 0, file: 0, decode: 0 };
    const run = pool.run.bind(pool);
    const fetch = pool.fetch.bind(pool);
    const target = pool as unknown as { run: BlobWorkerPool['run']; fetch: BlobWorkerPool['fetch'] };
    target.run = (job, body) => {
        counts[job.type]++;
        return run(job, body);
    };
    target.fetch = (job, url, signal) => {
        counts[job.type]++;
        return fetch(job, url, signal);
    };
    return counts;
}

const modes = [
    { name: 'the threads download', downloads: true },
    { name: 'the main thread downloads', downloads: false }
];

describe('download with worker threads', function () {
    this.timeout(120000);

    let service: FakeService;
    let http: HttpClient;
    let source: string;
    let target: string;
    let manifestId: string;
    let reader: BlobReader;
    let pool: BlobWorkerPool | undefined;

    const files: Record<string, Buffer> = { 'empty.dat': Buffer.alloc(0), 'one.bin': Buffer.from([1]), 'big/multi.bin': crypto.randomBytes(3 * 1024 * 1024 + 123), 'big/zeros.bin': Buffer.alloc(2 * 1024 * 1024) };
    for (let index = 0; index < 60; index++) {
        files[`small/dir${index % 4}/file-${index}.txt`] = crypto.randomBytes(100 + index * 83);
    }

    async function addArtifact(tree: Record<string, Buffer>): Promise<void> {
        writeTree(source, tree);
        manifestId = addFolderArtifact(service, { projectId: 'p-1', buildId: 7, artifactName: 'drop', sourcePath: source }).manifestId;
        const location = await discoverBlobStore(http, service.baseUrl + '/');
        reader = new BlobReader({ transport: new DedupTransport({ http, location }), http, concurrency: 16 });
    }

    beforeEach(async () => {
        telemetry.reset();
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true });
        source = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-wsrc-'));
        target = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-wdst-'));
    });

    afterEach(async () => {
        await pool?.close();
        pool = undefined;
        http.close();
        await service.stop();
        fs.rmSync(source, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
    });

    for (const mode of modes) {
        it(`creates small files and writes the chunks of big files on the threads, and the result equals the source (${mode.name})`, async () => {
            await addArtifact(files);
            pool = new BlobWorkerPool(3, { downloads: mode.downloads });
            const counts = counted(pool);
            const summary = await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
            assert.deepStrictEqual(readTree(target), readTree(source));
            assert.strictEqual(summary.files, Object.keys(files).length);
            assert.ok(counts.file >= 60, `${counts.file} files were created by a thread`);
            // A chunk is at most 2 MiB, so a file of 3 MiB has at least two chunks, whatever its content.
            assert.ok(counts.chunk >= 2, `${counts.chunk} chunks were written by a thread`);
            assert.deepStrictEqual(fs.readdirSync(path.join(target, 'big')).filter(name => name.endsWith('.tmp')), []);
            assert.strictEqual(pool.canFetch, mode.downloads);
            assert.strictEqual(telemetry.snapshot().workerFetches !== undefined, mode.downloads);
        });
    }

    it('stays on the main thread for a small download and never starts the threads', async () => {
        await addArtifact({ 'a.txt': Buffer.from('a'), 'b/c.txt': crypto.randomBytes(10000) });
        pool = new BlobWorkerPool(2);
        const counts = counted(pool);
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool });
        assert.deepStrictEqual(readTree(target), readTree(source));
        assert.deepStrictEqual(counts, { chunk: 0, file: 0, decode: 0 });
        assert.strictEqual(pool.available, false);
    });

    it('starts all the threads for a download of many small files, because the threads download them too', async () => {
        const many: Record<string, Buffer> = {};
        for (let index = 0; index < workerLimits(true, false).files; index++) {
            many[`many/f${index}.txt`] = Buffer.from(`file ${index}`);
        }
        await addArtifact(many);
        pool = new BlobWorkerPool(3, { downloads: true });
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool });
        assert.deepStrictEqual(readTree(target), readTree(source));
        assert.strictEqual(pool.available, true);
        assert.strictEqual((pool as unknown as PoolInternals).workers.length, 3);
        assert.strictEqual(telemetry.snapshot().workerThreads, 3, 'the telemetry tells how many threads were started');
    });

    it('leaves a processor to the main thread for many small files when the threads do not download them', async () => {
        const limit = workerLimits(false, false).files;
        pool = new BlobWorkerPool(3);
        const started = await startWorkersFor(pool, limit * 10, limit, nullLogger);
        assert.strictEqual(started, pool);
        assert.strictEqual((pool as unknown as PoolInternals).workers.length, 2);
        assert.strictEqual(pool.canFetch, false);
    });

    it('leaves a processor to the main thread for many small files when the pool is set not to download, whatever network settings the download has', async () => {
        const limit = workerLimits(false, false).files;
        pool = new BlobWorkerPool(3, { downloads: false });
        const started = await startWorkersFor(pool, limit * 10, limit, nullLogger, { network: { allowInsecureLoopback: true } });
        assert.strictEqual(started, pool);
        assert.strictEqual((pool as unknown as PoolInternals).workers.length, 2);
        assert.strictEqual(pool.canFetch, false);
    });

    it('lets all the threads download when the pool is set to download and the download has network settings', async () => {
        const limit = workerLimits(true, false).files;
        pool = new BlobWorkerPool(3, { downloads: true });
        const started = await startWorkersFor(pool, limit * 10, limit, nullLogger, { network: { allowInsecureLoopback: true } });
        assert.strictEqual(started, pool);
        assert.strictEqual((pool as unknown as PoolInternals).workers.length, 3);
        assert.strictEqual(pool.canFetch, true);
    });

    it('tells how many threads run, also when a later artifact asks for fewer than an earlier one started', async () => {
        const limits = workerLimits(false, false);
        pool = new BlobWorkerPool(3);
        await startWorkersFor(pool, limits.bytes, 1, nullLogger);
        assert.strictEqual(telemetry.snapshot().workerThreads, 3, 'big files use all the threads');
        await startWorkersFor(pool, limits.files, limits.files, nullLogger);
        assert.strictEqual(pool.running, 3);
        assert.strictEqual(telemetry.snapshot().workerThreads, 3, 'small files ask for two threads, and the three that run are kept');
    });

    it('does not start the threads for a few files that are just below the limit', async () => {
        const few: Record<string, Buffer> = {};
        for (let index = 0; index < workerLimits(true, false).files - 1; index++) {
            few[`few/f${index}.txt`] = Buffer.from(`file ${index}`);
        }
        await addArtifact(few);
        pool = new BlobWorkerPool(2, { downloads: true });
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool });
        assert.deepStrictEqual(readTree(target), readTree(source));
        assert.strictEqual(pool.available, false);
    });

    it('starts the threads for a download of many bytes', async () => {
        await addArtifact({ 'large.bin': crypto.randomBytes(workerLimits(true, false).bytes + 1024 * 1024) });
        pool = new BlobWorkerPool(3, { downloads: true });
        const counts = counted(pool);
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool });
        assert.deepStrictEqual(readTree(target), readTree(source));
        // A chunk is at most 2 MiB.
        assert.ok(counts.chunk >= 25, `${counts.chunk} chunks were written by a thread`);
    });

    for (const combination of [
        { name: 'threads that download, pipeline artifact', downloads: true, smallChunks: false },
        { name: 'threads that download, classic artifact', downloads: true, smallChunks: true },
        { name: 'threads that verify and write, pipeline artifact', downloads: false, smallChunks: false },
        { name: 'threads that verify and write, classic artifact', downloads: false, smallChunks: true }
    ]) {
        it(`starts the threads from the limits of the case, in bytes or in files, and not below either (${combination.name})`, async () => {
            const limits = workerLimits(combination.downloads, combination.smallChunks);
            const network = combination.downloads ? { allowInsecureLoopback: true } : undefined;
            const cases = [
                { bytes: limits.bytes - 1, files: 1, started: false },
                { bytes: limits.bytes, files: 1, started: true },
                { bytes: 0, files: limits.files - 1, started: false },
                { bytes: 0, files: limits.files, started: true }
            ];
            for (const item of cases) {
                const candidate = new BlobWorkerPool(2, { downloads: combination.downloads });
                try {
                    const started = await startWorkersFor(candidate, item.bytes, item.files, nullLogger, { network, smallChunks: combination.smallChunks });
                    assert.strictEqual(started !== undefined, item.started, `${item.bytes} bytes in ${item.files} files`);
                } finally {
                    await candidate.close();
                }
            }
        });
    }

    it('says in the debug log that the main thread does the work, and where the limits are', async () => {
        const lines: string[] = [];
        pool = new BlobWorkerPool(2, { downloads: true });
        await startWorkersFor(pool, 1, 1, { ...nullLogger, debug: message => lines.push(message) }, { network: { allowInsecureLoopback: true } });
        assert.strictEqual(pool.available, false);
        assert.ok(lines.some(line => line.includes('below the limits for worker threads') && line.includes('main thread')), lines.join('\n'));
    });

    it('does the work on the main thread when the threads cannot start', async () => {
        await addArtifact(files);
        pool = new BlobWorkerPool(2, { script: path.join(source, 'no-such-worker.js') });
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
        assert.deepStrictEqual(readTree(target), readTree(source));
        assert.strictEqual(pool.available, false);
        assert.strictEqual(telemetry.snapshot().workerStartFailures, 1);
        assert.strictEqual(telemetry.snapshot().workerThreads, undefined);
    });

    for (const mode of modes) {
        it(`finishes the download when the threads stop one after the other, on the main thread at last (${mode.name})`, async () => {
            await addArtifact(files);
            // Two threads: the first is stopped at the tenth job, the second at the fortieth. When the main thread downloads, small files keep one thread of the pool from starting.
            pool = new BlobWorkerPool(mode.downloads ? 2 : 3, { downloads: mode.downloads });
            const internals = pool as unknown as PoolInternals;
            const run = pool.run.bind(pool);
            const fetch = pool.fetch.bind(pool);
            let calls = 0;
            const hand = () => {
                calls++;
                if (calls === 10) {
                    void internals.workers[0].worker.terminate();
                } else if (calls === 40) {
                    void internals.workers[1].worker.terminate();
                }
            };
            const hooks = pool as unknown as { run: BlobWorkerPool['run']; fetch: BlobWorkerPool['fetch'] };
            hooks.run = (job, body) => {
                hand();
                return run(job, body);
            };
            hooks.fetch = (job, url, signal) => {
                hand();
                return fetch(job, url, signal);
            };
            await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
            assert.deepStrictEqual(readTree(target), readTree(source));
            assert.strictEqual(pool.available, false, 'both threads were stopped');
            assert.ok(calls > 40, `${calls} chunks went to the threads`);
            const counted = telemetry.snapshot();
            assert.ok((counted.workerFailures ?? 0) + (counted.workerFallbacks ?? 0) > 0, 'the work that the stopped threads held was counted');
            const leftovers = readTreeNames(target).filter(name => name.endsWith('.tmp'));
            assert.deepStrictEqual(leftovers, []);
        });
    }

    for (const mode of modes) {
        it(`downloads a chunk again that arrives damaged (${mode.name})`, async () => {
            await addArtifact({ 'multi.bin': crypto.randomBytes(3 * 1024 * 1024) });
            const [id, original] = Array.from(service.chunks.entries()).find(([, data]) => data.length > 400000)!;
            const damaged = Buffer.from(original);
            damaged[1000] ^= 0xff;
            service.chunks.set(id, damaged);
            let requests = 0;
            service.fault = request => {
                if (request.path.endsWith(`/storage/${id}`) && ++requests === 2) {
                    service.chunks.set(id, original);
                }
                return undefined;
            };
            pool = new BlobWorkerPool(2, { downloads: mode.downloads });
            await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
            assert.deepStrictEqual(readTree(target), readTree(source));
            assert.ok(requests >= 2, `${requests} requests for the damaged chunk`);
            assert.ok(telemetry.snapshot().integrityRetries >= 1, 'the damaged chunk was counted');
        });
    }

    it('lets the threads download the blobs of the files, so that the main thread only asks for the manifest and the nodes', async () => {
        await addArtifact(files);
        const mainRequests: string[] = [];
        const request = http.request.bind(http);
        (http as unknown as { request: HttpClient['request'] }).request = (input, options) => {
            mainRequests.push(input);
            return request(input, options);
        };
        pool = new BlobWorkerPool(3, { downloads: true });
        const counts = counted(pool);
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
        assert.deepStrictEqual(readTree(target), readTree(source));
        const downloaded = counts.chunk + counts.file;
        assert.ok(downloaded >= 62, `${downloaded} blobs were downloaded by a thread`);
        assert.strictEqual(telemetry.snapshot().workerFetches, downloaded);
        const fromMain = mainRequests.filter(url => url.includes('/storage/')).length;
        assert.strictEqual(service.countRequests('GET', '/storage/') - fromMain, downloaded, 'every blob of a file was requested by a thread');
        assert.ok(fromMain > 0 && fromMain < downloaded, `${fromMain} blobs were requested by the main thread`);
    });

    it('uses threads that started without network settings only to verify and write what the main thread downloads', async () => {
        await addArtifact(files);
        pool = new BlobWorkerPool(2, { downloads: true });
        await pool.start();
        assert.strictEqual(pool.canFetch, false);
        const counts = counted(pool);
        await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
        assert.deepStrictEqual(readTree(target), readTree(source));
        assert.ok(counts.file >= 60 && counts.chunk >= 2, `${counts.file} files and ${counts.chunk} chunks went to the threads`);
        assert.strictEqual(telemetry.snapshot().workerFetches, undefined);
        assert.strictEqual(pool.canFetch, false);
    });

    for (const mode of modes) {
        it(`downloads a chunk again when the service answers with an error or rejects its URL (${mode.name})`, async () => {
            await addArtifact({ 'multi.bin': crypto.randomBytes(3 * 1024 * 1024), 'a.txt': Buffer.from('some text') });
            const [id] = Array.from(service.chunks.entries()).find(([, data]) => data.length > 400000)!;
            let attempts = 0;
            service.fault = request => {
                if (!request.path.endsWith(`/storage/${id}`)) {
                    return undefined;
                }
                attempts++;
                return attempts === 1 ? 503 : attempts === 2 ? 403 : undefined;
            };
            pool = new BlobWorkerPool(2, { downloads: mode.downloads });
            await downloadManifestArtifact({ reader, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 } });
            assert.deepStrictEqual(readTree(target), readTree(source));
            assert.strictEqual(attempts, 3);
            assert.strictEqual(telemetry.snapshot().blobRetries, 2);
            assert.strictEqual(telemetry.snapshot().throttled, 1, 'the answer was counted, wherever it was received');
        });
    }

    it('gives up the downloads on the threads when the download is canceled, and no thread is left with a file that is closed', async () => {
        await addArtifact({ 'multi.bin': crypto.randomBytes(6 * 1024 * 1024) });
        const controller = new AbortController();
        const location = await discoverBlobStore(http, service.baseUrl + '/');
        const cancelable = new BlobReader({ transport: new DedupTransport({ http, location }), http, concurrency: 16, signal: controller.signal });
        service.storageDelayMs = 200;
        pool = new BlobWorkerPool(2, { downloads: true });
        const internals = pool as unknown as PoolInternals;
        const outcome = downloadManifestArtifact({ reader: cancelable, manifestId, targetDirectory: target, workers: pool, workerThresholds: { bytes: 0, files: 0 }, signal: controller.signal })
            .then(() => 'finished', error => error);
        const deadline = Date.now() + 10000;
        while (!internals.workers.some(entry => entry.pending.size > 0) && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        controller.abort();
        assert.ok(await outcome instanceof AbortedError);
        assert.deepStrictEqual(internals.workers.map(entry => entry.pending.size), [0, 0], 'every job ended with the answer of its thread');
        assert.deepStrictEqual(readTreeNames(target).filter(name => name.endsWith('.tmp')), []);
        assert.strictEqual(pool.available, true, 'the threads are still there for the next download');
    });

    function readTreeNames(root: string, prefix = ''): string[] {
        return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            return entry.isDirectory() ? readTreeNames(root, relative) : [relative];
        });
    }
});
