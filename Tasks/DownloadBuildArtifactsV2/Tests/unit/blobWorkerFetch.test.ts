import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import { AbortedError, HttpError, IntegrityError, WorkerFailedError, WorkerUnavailableError } from '../../DownloadEngine/errors';
import { DedupTransport, discoverBlobStore } from '../../DownloadEngine/dedup/blobStore';
import { BlobReader } from '../../DownloadEngine/dedup/blobReader';
import { BlobWorkerPool } from '../../DownloadEngine/dedup/blobWorkerPool';
import { WorkerJob } from '../../DownloadEngine/dedup/blobWorkerProtocol';
import { chunkIdOf } from '../../DownloadEngine/dedup/hashing';
import { HttpClient, isTransientError } from '../../DownloadEngine/http/httpClient';
import { telemetry } from '../../DownloadEngine/util/telemetry';
import { FakeService } from './fakeService';

const limit = 4 * 1024 * 1024;
const sleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

interface PoolInternals {
    workers: Array<{ worker: { terminate(): Promise<number> }; pending: Map<number, unknown> }>;
}

describe('BlobWorkerPool threads that download', function () {
    this.timeout(60000);

    let directory: string;
    let server: http.Server;
    let baseUrl: string;
    let pool: BlobWorkerPool | undefined;
    let requests: number;
    const blobs = new Map<string, Buffer>();
    // Handles a request itself and returns true; false leaves it to the server, which answers with the stored blob.
    let behavior: (request: http.IncomingMessage, response: http.ServerResponse) => boolean;

    beforeEach(async () => {
        telemetry.reset();
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-fetch-'));
        blobs.clear();
        requests = 0;
        behavior = () => false;
        server = http.createServer((request, response) => {
            requests++;
            if (behavior(request, response)) {
                return;
            }
            const data = blobs.get((request.url ?? '').substring(1));
            if (data) {
                response.end(data);
            } else {
                response.statusCode = 404;
                response.end('no such blob');
            }
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        await pool?.close();
        pool = undefined;
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function started(size = 2): Promise<BlobWorkerPool> {
        pool = new BlobWorkerPool(size);
        pool.configureNetwork({ allowInsecureLoopback: true });
        assert.strictEqual(await pool.start(), true);
        return pool;
    }

    function store(data: Buffer): string {
        const id = chunkIdOf(data);
        blobs.set(id, data);
        return id;
    }

    function chunkJob(id: string, size: number, fd: number, position: number): WorkerJob {
        return { type: 'chunk', id, size, limit, fd, position };
    }

    it('downloads chunks, verifies them and writes them at their positions of a file that the caller has open', async () => {
        const workers = await started(3);
        const chunks = Array.from({ length: 40 }, (_, index) => crypto.randomBytes(900 + index * 997));
        const target = path.join(directory, 'file.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            let position = 0;
            await Promise.all(chunks.map(chunk => {
                const id = store(chunk);
                const job = chunkJob(id, chunk.length, handle.fd, position);
                position += chunk.length;
                return workers.fetch(job, `${baseUrl}/${id}`);
            }));
        } finally {
            await handle.close();
        }
        assert.deepStrictEqual(fs.readFileSync(target), Buffer.concat(chunks));
        assert.strictEqual(workers.canFetch, true);
    });

    it('creates a whole file from a blob that it downloads', async () => {
        const workers = await started();
        const data = crypto.randomBytes(50000);
        const id = store(data);
        const destination = path.join(directory, 'created.bin');
        await workers.fetch({ type: 'file', id, size: data.length, limit, temporary: destination + '.tmp', destination }, `${baseUrl}/${id}`);
        assert.deepStrictEqual(fs.readFileSync(destination), data);
        assert.strictEqual(fs.existsSync(destination + '.tmp'), false);
    });

    it('reports the status of a failed download, and how long the service asks to wait', async () => {
        const workers = await started();
        const data = crypto.randomBytes(1000);
        const id = store(data);
        const target = path.join(directory, 'file.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            behavior = (_, response) => {
                response.statusCode = 503;
                response.setHeader('Retry-After', '2');
                response.end('busy');
                return true;
            };
            await assert.rejects(() => workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`), (error: unknown) => {
                assert.ok(error instanceof HttpError, 'the class of the error survives the thread');
                assert.strictEqual(error.status, 503);
                assert.strictEqual(error.retryAfterMs, 2000);
                assert.strictEqual(isTransientError(error), true);
                return true;
            });

            behavior = (_, response) => {
                response.statusCode = 403;
                response.end('the signature has expired');
                return true;
            };
            await assert.rejects(() => workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`), (error: unknown) => error instanceof HttpError && error.status === 403 && !isTransientError(error));
        } finally {
            await handle.close();
        }
        assert.strictEqual(fs.statSync(target).size, 0, 'nothing was written');
    });

    it('reports a connection that breaks as a network error that is worth repeating', async () => {
        const workers = await started();
        const data = crypto.randomBytes(1000);
        const id = store(data);
        behavior = request => {
            request.socket.destroy();
            return true;
        };
        const handle = await fs.promises.open(path.join(directory, 'file.bin'), 'w');
        try {
            await assert.rejects(() => workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`), (error: unknown) => {
                assert.strictEqual(isTransientError(error), true, String(error));
                return true;
            });
        } finally {
            await handle.close();
        }
    });

    it('rejects a blob that does not match its identifier with an IntegrityError and writes nothing', async () => {
        const workers = await started();
        const data = crypto.randomBytes(5000);
        const id = chunkIdOf(data);
        blobs.set(id, crypto.randomBytes(5000));
        const target = path.join(directory, 'file.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            await assert.rejects(() => workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`), IntegrityError);
        } finally {
            await handle.close();
        }
        assert.strictEqual(fs.statSync(target).size, 0);
    });

    it('gives up a download when the signal aborts, answers the job with AbortedError, and keeps working', async () => {
        const workers = await started(1);
        const data = crypto.randomBytes(2000);
        const id = store(data);
        const target = path.join(directory, 'file.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            behavior = () => true;
            const controller = new AbortController();
            const download = workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`, controller.signal);
            const outcome = download.then(() => 'finished', error => error);
            await sleep(100);
            assert.strictEqual(requests, 1, 'the download is under way');
            controller.abort();
            assert.ok(await outcome instanceof AbortedError);
            assert.strictEqual((workers as unknown as PoolInternals).workers[0].pending.size, 0, 'the thread has answered the job');

            behavior = () => false;
            await workers.fetch(chunkJob(id, data.length, handle.fd, 0), `${baseUrl}/${id}`);
        } finally {
            await handle.close();
        }
        assert.deepStrictEqual(fs.readFileSync(target), data);
    });

    it('does not send a download when the signal has aborted already', async () => {
        const workers = await started();
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(() => workers.fetch({ type: 'decode', id: chunkIdOf(Buffer.alloc(1)), size: 1, limit }, `${baseUrl}/x`, controller.signal), AbortedError);
        assert.strictEqual(requests, 0);
    });

    it('cannot download without network settings, without threads, or when it is closed, but still works on bytes', async () => {
        const url = `${baseUrl}/x`;
        const job: WorkerJob = { type: 'decode', id: chunkIdOf(Buffer.from('x')), size: 1, limit };
        pool = new BlobWorkerPool(2);
        await assert.rejects(() => pool!.fetch(job, url), WorkerUnavailableError);
        assert.strictEqual(await pool.start(), true);
        assert.strictEqual(pool.canFetch, false, 'its threads started without network settings');
        await assert.rejects(() => pool!.fetch(job, url), WorkerUnavailableError);
        assert.deepStrictEqual(await pool.run(job, Buffer.from('x')), Buffer.from('x'));
        await pool.close();

        const configured = await started();
        assert.strictEqual(configured.canFetch, true);
        await configured.close();
        assert.strictEqual(configured.canFetch, false);
        await assert.rejects(() => configured.fetch(job, url), WorkerUnavailableError);
    });

    it('adds the telemetry of its threads to the telemetry of the process', async () => {
        const workers = await started();
        const data = crypto.randomBytes(1000);
        const id = store(data);
        behavior = (_, response) => {
            response.statusCode = 503;
            response.end('busy');
            return true;
        };
        await assert.rejects(() => workers.fetch({ type: 'decode', id, size: data.length, limit }, `${baseUrl}/${id}`), HttpError);
        assert.strictEqual(telemetry.snapshot().throttled, 1);
    });

    it('fails a download with WorkerFailedError when its thread stops, and the other thread keeps working', async () => {
        const workers = await started(2);
        const data = crypto.randomBytes(1000);
        const id = store(data);
        behavior = () => true;
        const downloads = [0, 1].map(() => workers.fetch({ type: 'decode', id, size: data.length, limit }, `${baseUrl}/${id}`));
        const outcomes = downloads.map(download => download.then(() => 'finished', error => error));
        await sleep(100);
        await (workers as unknown as PoolInternals).workers[0].worker.terminate();
        await sleep(100);
        assert.ok(await Promise.race(outcomes) instanceof WorkerFailedError);

        behavior = () => false;
        assert.deepStrictEqual(await workers.fetch({ type: 'decode', id, size: data.length, limit }, `${baseUrl}/${id}`), data);
        await workers.close();
        assert.ok((await Promise.all(outcomes)).every(outcome => outcome instanceof WorkerFailedError));
    });
});

describe('BlobReader with threads that download', function () {
    this.timeout(60000);

    let service: FakeService;
    let http: HttpClient;
    let reader: BlobReader;
    let pool: BlobWorkerPool;
    let directory: string;
    let handle: fs.promises.FileHandle;
    let file: string;

    beforeEach(async () => {
        telemetry.reset();
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true });
        const location = await discoverBlobStore(http, service.baseUrl + '/');
        reader = new BlobReader({ transport: new DedupTransport({ http, location }), http, concurrency: 4 });
        pool = new BlobWorkerPool(2);
        pool.configureNetwork(reader.workerNetworkOptions());
        await pool.start();
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-reader-fetch-'));
        file = path.join(directory, 'file.bin');
        handle = await fs.promises.open(file, 'w');
    });

    afterEach(async () => {
        await handle.close().catch(() => undefined);
        await pool.close();
        http.close();
        await service.stop();
        fs.rmSync(directory, { recursive: true, force: true });
    });

    function stored(data: Buffer): { id: string; job: WorkerJob } {
        const id = chunkIdOf(data);
        service.chunks.set(id, data);
        return { id, job: { type: 'chunk', id, size: data.length, limit, fd: handle.fd, position: 0 } };
    }

    function storageRequests(): number {
        return service.countRequests('GET', '/storage/');
    }

    it('lets a thread download a blob from the URL that the reader resolved', async () => {
        const data = crypto.randomBytes(30000);
        const { id, job } = stored(data);
        await reader.fetchBlobInWorker(id, job, pool);
        assert.deepStrictEqual(fs.readFileSync(file), data);
        assert.strictEqual(service.countRequests('POST', '/_apis/dedup/urls'), 1);
        assert.strictEqual(storageRequests(), 1);
        assert.strictEqual(telemetry.snapshot().workerFetches, 1);
    });

    it('resolves a fresh URL and downloads again when the service rejects the URL', async () => {
        const data = crypto.randomBytes(30000);
        const { id, job } = stored(data);
        let rejected = 0;
        service.fault = request => request.path.includes('/storage/') && rejected++ === 0 ? 403 : undefined;
        await reader.fetchBlobInWorker(id, job, pool);
        assert.deepStrictEqual(fs.readFileSync(file), data);
        assert.strictEqual(service.countRequests('POST', '/_apis/dedup/urls'), 2, 'the URL was resolved again');
        assert.strictEqual(storageRequests(), 2);
        assert.strictEqual(telemetry.snapshot().blobRetries, 1);
    });

    it('downloads again when the service answers with a server error', async () => {
        const data = crypto.randomBytes(30000);
        const { id, job } = stored(data);
        let failed = 0;
        service.fault = request => request.path.includes('/storage/') && failed++ < 2 ? 503 : undefined;
        await reader.fetchBlobInWorker(id, job, pool);
        assert.deepStrictEqual(fs.readFileSync(file), data);
        assert.strictEqual(storageRequests(), 3);
        assert.strictEqual(telemetry.snapshot().blobRetries, 2);
        assert.strictEqual(telemetry.snapshot().throttled, 2, 'the answers that the thread received were counted');
    });

    it('does not repeat a request that the service rejects for a reason that has nothing to do with the URL', async () => {
        const data = crypto.randomBytes(1000);
        const { id, job } = stored(data);
        service.fault = request => request.path.includes('/storage/') ? 400 : undefined;
        await assert.rejects(() => reader.fetchBlobInWorker(id, job, pool), (error: unknown) => error instanceof HttpError && error.status === 400);
        assert.strictEqual(storageRequests(), 1, 'a client error that is not about the URL is not repeated');
    });

    it('downloads again when the thread that downloads stops, with the thread that is left', async () => {
        const data = crypto.randomBytes(30000);
        const { id, job } = stored(data);
        service.storageDelayMs = 300;
        const download = reader.fetchBlobInWorker(id, job, pool);
        await sleep(100);
        const internals = pool as unknown as PoolInternals;
        const busy = internals.workers.find(entry => entry.pending.size > 0)!;
        await busy.worker.terminate();
        await download;
        assert.deepStrictEqual(fs.readFileSync(file), data);
        assert.strictEqual(telemetry.snapshot().workerFailures, 1);
        assert.strictEqual(pool.running, 1);
    });

    it('does not repeat when no thread can download, so that the caller can do the work itself', async () => {
        const data = crypto.randomBytes(1000);
        const { id, job } = stored(data);
        await pool.close();
        await assert.rejects(() => reader.fetchBlobInWorker(id, job, pool), WorkerUnavailableError);
        assert.strictEqual(storageRequests(), 0);
        assert.strictEqual(telemetry.snapshot().blobRetries, undefined);
    });
});
