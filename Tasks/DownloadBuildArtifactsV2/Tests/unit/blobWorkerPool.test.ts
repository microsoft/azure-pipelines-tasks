import * as assert from 'assert';
import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IntegrityError, WorkerFailedError, WorkerUnavailableError } from '../../DownloadEngine/errors';
import { BlobWorkerPool, MAX_WORKER_THREADS, defaultWorkerDownloads, defaultWorkerThreads, getSharedWorkerPool, closeSharedWorkerPool } from '../../DownloadEngine/dedup/blobWorkerPool';
import { MAX_CHUNK_BYTES, chunkIdOf } from '../../DownloadEngine/dedup/hashing';
import { encodeLz77, expandLz77, randomLz77Program } from './lz77Encoder';

const limit = 4 * 1024 * 1024;

interface PoolInternals {
    workers: Array<{ worker: { terminate(): Promise<number> }; pending: Map<number, unknown> }>;
}

describe('BlobWorkerPool', function () {
    this.timeout(60000);

    let directory: string;
    let pool: BlobWorkerPool | undefined;

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-pool-'));
    });

    afterEach(async () => {
        await pool?.close();
        pool = undefined;
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function started(size = 2): Promise<BlobWorkerPool> {
        pool = new BlobWorkerPool(size);
        assert.strictEqual(await pool.start(), true);
        return pool;
    }

    it('starts its threads and says whether it can work', async () => {
        pool = new BlobWorkerPool(2);
        assert.strictEqual(pool.available, false);
        assert.strictEqual(await pool.start(), true);
        assert.strictEqual(pool.available, true);
        assert.strictEqual(await pool.start(), true);
        await pool.close();
        assert.strictEqual(pool.available, false);
    });

    it('starts as many threads as it is asked for, and more when it is asked again', async () => {
        pool = new BlobWorkerPool(3);
        const internals = pool as unknown as PoolInternals;
        assert.strictEqual(await pool.start(1), true);
        assert.strictEqual(internals.workers.length, 1);
        assert.strictEqual(await pool.start(3), true);
        assert.strictEqual(internals.workers.length, 3);
        assert.strictEqual(await pool.start(2), true, 'threads that run are kept');
        assert.strictEqual(internals.workers.length, 3);
        assert.strictEqual(await pool.start(10), true, 'more than the pool has is not started');
        assert.strictEqual(internals.workers.length, 3);
    });

    it('verifies chunks and writes them at their positions of a file that the caller has open', async () => {
        const workers = await started(3);
        const chunks = Array.from({ length: 60 }, (_, index) => crypto.randomBytes(900 + index * 997));
        const target = path.join(directory, 'file.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            let position = 0;
            await Promise.all(chunks.map(chunk => {
                const at = position;
                position += chunk.length;
                return workers.run({ type: 'chunk', id: chunkIdOf(chunk), size: chunk.length, limit, fd: handle.fd, position: at }, Buffer.from(chunk));
            }));
        } finally {
            await handle.close();
        }
        assert.ok(fs.readFileSync(target).equals(Buffer.concat(chunks)));
    });

    it('decompresses a compressed blob before it writes it, and verifies the content', async () => {
        const workers = await started(1);
        const ops = randomLz77Program(99, 80);
        const content = expandLz77(ops);
        const compressed = encodeLz77(ops);
        const target = path.join(directory, 'compressed.bin');
        const handle = await fs.promises.open(target, 'w');
        try {
            await workers.run({ type: 'chunk', id: chunkIdOf(content), size: content.length, limit, fd: handle.fd, position: 0 }, Buffer.from(compressed));
        } finally {
            await handle.close();
        }
        assert.ok(fs.readFileSync(target).equals(content));

        const decoded = await workers.run({ type: 'decode', id: chunkIdOf(content), size: undefined, limit }, Buffer.from(compressed));
        assert.ok(decoded && decoded.equals(content));
    });

    it('creates a whole file: temporary file, content, check and rename', async () => {
        const workers = await started(2);
        const content = crypto.randomBytes(70000);
        const destination = path.join(directory, 'new.bin');
        const temporary = path.join(directory, '.new.bin.1234.tmp');
        await workers.run({ type: 'file', id: chunkIdOf(content), size: content.length, limit, temporary, destination }, Buffer.from(content));
        assert.ok(fs.readFileSync(destination).equals(content));
        assert.strictEqual(fs.existsSync(temporary), false);

        const other = crypto.randomBytes(10);
        await workers.run({ type: 'file', id: chunkIdOf(other), size: other.length, limit, temporary, destination }, Buffer.from(other));
        assert.ok(fs.readFileSync(destination).equals(other));
    });

    it('creates many files at once', async () => {
        const workers = await started(4);
        const contents = Array.from({ length: 400 }, (_, index) => crypto.randomBytes(1 + (index * 211) % 20000));
        await Promise.all(contents.map((content, index) => workers.run({
            type: 'file', id: chunkIdOf(content), size: content.length, limit,
            temporary: path.join(directory, `.f${index}.tmp`), destination: path.join(directory, `f${index}.bin`)
        }, Buffer.from(content))));
        contents.forEach((content, index) => assert.ok(fs.readFileSync(path.join(directory, `f${index}.bin`)).equals(content), `file ${index}`));
        assert.deepStrictEqual(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')), []);
    });

    it('rejects a blob that does not match its identifier with an IntegrityError and writes nothing', async () => {
        const workers = await started(1);
        const content = crypto.randomBytes(5000);
        const damaged = Buffer.from(content);
        damaged[10] ^= 1;
        const destination = path.join(directory, 'bad.bin');
        const temporary = path.join(directory, '.bad.tmp');
        await assert.rejects(
            () => workers.run({ type: 'file', id: chunkIdOf(content), size: content.length, limit, temporary, destination }, damaged),
            (error: Error) => error instanceof IntegrityError && /neither valid raw data nor supported compressed content/.test(error.message));
        assert.strictEqual(fs.existsSync(destination), false);
        assert.strictEqual(fs.existsSync(temporary), false);

        await assert.rejects(
            () => workers.run({ type: 'decode', id: chunkIdOf(content), size: content.length + 1, limit }, Buffer.from(content)),
            (error: Error) => error instanceof IntegrityError && /advertised size/.test(error.message));
    });

    it('reports a failed file operation with the properties of the error, and leaves no temporary file', async () => {
        const workers = await started(1);
        const content = Buffer.from('content');
        const missing = path.join(directory, 'missing', 'a.tmp');
        await assert.rejects(
            () => workers.run({ type: 'file', id: chunkIdOf(content), size: content.length, limit, temporary: missing, destination: path.join(directory, 'missing', 'a') }, Buffer.from(content)),
            (error: NodeJS.ErrnoException) => error.code === 'ENOENT' && error.syscall === 'open' && /ENOENT/.test(error.message));

        // A destination that cannot be replaced: the temporary file written before is removed again.
        const blocked = path.join(directory, 'blocked');
        fs.mkdirSync(path.join(blocked, 'inner'), { recursive: true });
        const temporary = path.join(directory, '.blocked.tmp');
        await assert.rejects(() => workers.run({ type: 'file', id: chunkIdOf(content), size: content.length, limit, temporary, destination: blocked }, Buffer.from(content)));
        assert.strictEqual(fs.existsSync(temporary), false);

        await assert.rejects(
            () => workers.run({ type: 'chunk', id: chunkIdOf(content), size: content.length, limit, fd: 2 ** 30, position: 0 }, Buffer.from(content)),
            (error: NodeJS.ErrnoException) => error.code === 'EBADF');
    });

    it('cannot work without threads, when its threads cannot start, or when it is closed', async () => {
        pool = new BlobWorkerPool(0);
        assert.strictEqual(await pool.start(), false);
        await assert.rejects(() => pool!.run({ type: 'decode', id: chunkIdOf(Buffer.alloc(1)), size: 1, limit }, Buffer.alloc(1)), WorkerUnavailableError);

        const broken = new BlobWorkerPool(2, { script: path.join(directory, 'does-not-exist.js') });
        assert.strictEqual(await broken.start(), false);
        assert.strictEqual(broken.available, false);
        await broken.close();

        const closed = await started(1);
        await closed.close();
        await assert.rejects(() => closed.run({ type: 'decode', id: chunkIdOf(Buffer.alloc(1)), size: 1, limit }, Buffer.alloc(1)), WorkerUnavailableError);
    });

    it('fails the work of a thread that stops, and the other threads keep working', async () => {
        const workers = await started(2);
        // A few bytes that expand to 12 MiB: every job keeps a thread busy for some milliseconds.
        const content = Buffer.alloc(12 * 1024 * 1024, 'A');
        const compressed = encodeLz77([{ literal: Buffer.from('A') }, { offset: 1, length: content.length - 1 }]);
        const id = chunkIdOf(content);
        const internals = workers as unknown as PoolInternals;

        const jobs = Array.from({ length: 40 }, () => workers.run({ type: 'decode', id, size: content.length, limit: MAX_CHUNK_BYTES }, Buffer.from(compressed)).then(() => 'done', (error: Error) => error));
        await internals.workers[0].worker.terminate();
        const results = await Promise.all(jobs);
        const failures = results.filter(result => result !== 'done');
        assert.ok(failures.length > 0, 'the stopped thread had work');
        assert.ok(failures.every(failure => failure instanceof WorkerFailedError), 'the work of a stopped thread fails with a WorkerFailedError');
        assert.ok(results.includes('done'), 'the other thread finished its work');
        assert.strictEqual(workers.available, true);

        const small = Buffer.from('still works');
        const echoed = await workers.run({ type: 'decode', id: chunkIdOf(small), size: small.length, limit }, Buffer.from(small));
        assert.ok(echoed && echoed.equals(small));

        await internals.workers[1].worker.terminate();
        assert.strictEqual(workers.available, false);
        await assert.rejects(() => workers.run({ type: 'decode', id: chunkIdOf(small), size: small.length, limit }, Buffer.from(small)), WorkerUnavailableError);
    });

    it('fails the work of a pool that is closed only when its thread has stopped, so that nothing writes to a file the caller may already have closed', async () => {
        const workers = await started(1);
        const internals = workers as unknown as PoolInternals;
        const thread = internals.workers[0].worker as unknown as { threadId: number };
        const content = Buffer.alloc(12 * 1024 * 1024, 'A');
        const compressed = encodeLz77([{ literal: Buffer.from('A') }, { offset: 1, length: content.length - 1 }]);
        const id = chunkIdOf(content);

        const threadIdsAtFailure: number[] = [];
        const jobs = Array.from({ length: 12 }, () => workers.run({ type: 'decode', id, size: content.length, limit: MAX_CHUNK_BYTES }, Buffer.from(compressed)).then(
            () => 'done',
            (error: Error) => {
                assert.ok(error instanceof WorkerFailedError);
                threadIdsAtFailure.push(thread.threadId);
                return 'failed';
            }));
        await workers.close();
        await Promise.all(jobs);
        assert.ok(threadIdsAtFailure.length > 0, 'some work was still running when the pool was closed');
        assert.ok(threadIdsAtFailure.every(threadId => threadId === -1), `the thread had exited when its work failed: ${threadIdsAtFailure.join(',')}`);
    });

    it('does not report a thread that does not start as available, and gives up on it at the time limit', async () => {
        const idle = path.join(directory, 'idle-worker.js');
        fs.writeFileSync(idle, 'setInterval(() => undefined, 1000);\n');
        const stuck = new BlobWorkerPool(2, { script: idle, startTimeoutMs: 300 });
        const began = Date.now();
        assert.strictEqual(await stuck.start(), false);
        assert.ok(Date.now() - began < 5000, 'the start ends at the time limit');
        assert.strictEqual(stuck.available, false);
        assert.strictEqual((stuck as unknown as PoolInternals).workers.length, 0);
        await assert.rejects(() => stuck.run({ type: 'decode', id: chunkIdOf(Buffer.alloc(1)), size: 1, limit }, Buffer.alloc(1)), WorkerUnavailableError);
        await stuck.close();
    });

    it('keeps the process alive while it has work, and lets it end afterwards although nobody closed the pool', () => {
        const script = `
            const { BlobWorkerPool } = require(${JSON.stringify(require.resolve('../../DownloadEngine/dedup/blobWorkerPool'))});
            const { chunkIdOf } = require(${JSON.stringify(require.resolve('../../DownloadEngine/dedup/hashing'))});
            (async () => {
                const pool = new BlobWorkerPool(2);
                if (!await pool.start()) { process.exit(3); }
                const data = Buffer.alloc(3 * 1024 * 1024, 7);
                const out = await pool.run({ type: 'decode', id: chunkIdOf(data), size: data.length, limit: 4194304 }, Buffer.from(data));
                if (!out || !out.equals(data)) { process.exit(4); }
                console.log('work finished');
            })();`;
        const started = Date.now();
        const result = spawnSync(process.execPath, ['-e', script], { timeout: 30000, encoding: 'utf8' });
        assert.strictEqual(result.status, 0, `${result.stdout}${result.stderr}`);
        assert.ok(result.stdout.includes('work finished'), `the process ended before the work finished: ${result.stdout}${result.stderr}`);
        assert.ok(Date.now() - started < 25000, 'the process did not end');
    });

    it('chooses the number of threads from the processors and offers one pool to all downloads', async () => {
        assert.ok(defaultWorkerThreads() >= 0 && defaultWorkerThreads() <= MAX_WORKER_THREADS);
        assert.deepStrictEqual([1, 2, 3, MAX_WORKER_THREADS, MAX_WORKER_THREADS + 1, 64].map(processors => defaultWorkerThreads(processors)), [0, 2, 3, MAX_WORKER_THREADS, MAX_WORKER_THREADS, MAX_WORKER_THREADS]);
        assert.strictEqual(getSharedWorkerPool(0), undefined);
        assert.strictEqual(getSharedWorkerPool(-3), undefined);
        const first = getSharedWorkerPool(2);
        assert.ok(first);
        assert.strictEqual(getSharedWorkerPool(5), first);
        assert.strictEqual(first!.size, 2);
        await closeSharedWorkerPool();
        const second = getSharedWorkerPool(100);
        assert.notStrictEqual(second, first);
        assert.strictEqual(second!.size, MAX_WORKER_THREADS);
        await closeSharedWorkerPool();
    });

    it('lets the threads download by default only on a machine with more than two processors', () => {
        assert.deepStrictEqual([1, 2, 3, 4, 16].map(processors => defaultWorkerDownloads(processors)), [false, false, true, true, true]);
        assert.strictEqual(typeof defaultWorkerDownloads(), 'boolean');
        assert.strictEqual(new BlobWorkerPool(2).downloads, defaultWorkerDownloads());
    });

    it('takes the choice whether the threads download from its settings, for the pool that all downloads share as well', async () => {
        assert.strictEqual(new BlobWorkerPool(2, { downloads: true }).downloads, true);
        assert.strictEqual(new BlobWorkerPool(2, { downloads: false }).downloads, false);
        for (const choice of [true, false]) {
            const shared = getSharedWorkerPool(2, choice);
            assert.strictEqual(shared!.downloads, choice);
            await closeSharedWorkerPool();
        }
        assert.strictEqual(getSharedWorkerPool(2)!.downloads, defaultWorkerDownloads());
        await closeSharedWorkerPool();
    });
});
