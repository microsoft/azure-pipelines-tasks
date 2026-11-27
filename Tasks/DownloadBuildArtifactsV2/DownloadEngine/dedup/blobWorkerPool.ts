import * as path from 'path';
import { Worker } from 'worker_threads';
import { AbortedError, WorkerFailedError, WorkerUnavailableError } from '../errors';
import { HttpClientWorkerOptions } from '../http/httpClient';
import { availableProcessors } from '../util/processors';
import { telemetry } from '../util/telemetry';
import { WorkerCancel, WorkerData, WorkerJob, WorkerRequest, WorkerResponse, deserializeError, toTransferable } from './blobWorkerProtocol';

/** More threads do not help: the connections and the disk limit a download first. */
export const MAX_WORKER_THREADS = 8;

const START_TIMEOUT_MS = 10000;

interface PendingJob {
    resolve: (content: Buffer | undefined) => void;
    reject: (error: unknown) => void;
    /** Takes back what the job registered with the signal of its caller. */
    release?: () => void;
}

interface PoolWorker {
    worker: Worker;
    alive: boolean;
    /** The thread has network settings, so it can download blobs. */
    fetches: boolean;
    pending: Map<number, PendingJob>;
    ready: Promise<void>;
}

/** One thread per processor, none on a single-processor machine, where a thread would only add work. */
export function defaultWorkerThreads(processors: number = availableProcessors()): number {
    return processors <= 1 ? 0 : Math.min(MAX_WORKER_THREADS, processors);
}

/**
 * The threads download the blobs themselves only on a machine with more than two processors. On two, both are busy either way, and threads
 * that download use more processor time and memory than a main thread that downloads, so there they only verify and write.
 */
export function defaultWorkerDownloads(processors: number = availableProcessors()): boolean {
    return processors > 2;
}

export interface BlobWorkerPoolOptions {
    /** The script that a thread runs. */
    script?: string;
    startTimeoutMs?: number;
    /** Whether the threads download blobs when the download gives them network settings. By default they do on a machine with more than two processors. */
    downloads?: boolean;
}

/**
 * Worker threads that verify, decompress and write blobs, and where `downloads` is set download them as well, so that all this work does not
 * fall on the main thread. A thread keeps the process alive only while it has a job, so a pool that nobody closes cannot prevent the process
 * from ending.
 */
export class BlobWorkerPool {
    /** Whether the threads download blobs when a download gives them network settings; if not, they verify and write what the main thread downloads. */
    readonly downloads: boolean;
    private readonly script: string;
    private readonly startTimeoutMs: number;
    private workers: PoolWorker[] = [];
    private starting: Promise<boolean> = Promise.resolve(false);
    private closed = false;
    private broken = false;
    private nextJobId = 1;
    private network: HttpClientWorkerOptions | undefined;

    constructor(readonly size: number, options: BlobWorkerPoolOptions = {}) {
        this.script = options.script ?? path.join(__dirname, 'blobWorker.js');
        this.startTimeoutMs = options.startTimeoutMs ?? START_TIMEOUT_MS;
        this.downloads = options.downloads ?? defaultWorkerDownloads();
    }

    get available(): boolean {
        return !this.closed && this.workers.some(entry => entry.alive);
    }

    /** Some running thread can download blobs. */
    get canFetch(): boolean {
        return !this.closed && this.workers.some(entry => entry.alive && entry.fetches);
    }

    get running(): number {
        return this.workers.filter(entry => entry.alive).length;
    }

    /** The threads that start from now on download blobs with these network settings, which should be those of the client of the caller. */
    configureNetwork(options: HttpClientWorkerOptions): void {
        this.network = options;
    }

    /**
     * Starts threads until `threads` of them run (all by default). Resolves to false when none could be started, in which case the
     * caller does the work itself. Repeating a call is cheap: running threads are kept.
     */
    start(threads: number = this.size): Promise<boolean> {
        const wanted = Math.min(this.size, Math.max(1, Math.floor(threads)));
        this.starting = this.starting.then(() => this.spawnUpTo(wanted));
        return this.starting;
    }

    private async spawnUpTo(wanted: number): Promise<boolean> {
        if (this.closed || this.broken || !(this.size >= 1)) {
            return false;
        }
        const created: PoolWorker[] = [];
        while (this.workers.filter(entry => entry.alive).length + created.length < wanted) {
            try {
                created.push(this.spawn());
            } catch {
                break;
            }
        }
        this.workers.push(...created);
        await Promise.all(created.map(entry => entry.ready.catch(() => undefined)));
        this.workers = this.workers.filter(entry => entry.alive);
        if (this.workers.length === 0) {
            this.broken = true;
        }
        return this.available;
    }

    private spawn(): PoolWorker {
        const data: WorkerData = { http: this.network };
        const worker = new Worker(this.script, { workerData: data });
        const entry: PoolWorker = { worker, alive: true, fetches: this.network !== undefined, pending: new Map(), ready: undefined as unknown as Promise<void> };
        let markReady!: () => void;
        let markFailed!: (error: Error) => void;
        entry.ready = new Promise<void>((resolve, reject) => {
            markReady = resolve;
            markFailed = reject;
        });

        // A retiring thread gets no more work, but its pending jobs fail only after it has exited: the caller closes a file as soon as
        // its jobs fail, and a thread that is still writing could then hit a reused file descriptor.
        const retire = (reason: string) => {
            clearTimeout(timer);
            entry.alive = false;
            markFailed(new Error(reason));
        };

        const timer = setTimeout(() => {
            retire('A worker thread did not start in time.');
            worker.terminate().catch(() => undefined);
        }, this.startTimeoutMs);

        worker.on('message', (response: WorkerResponse) => {
            if ('ready' in response) {
                clearTimeout(timer);
                markReady();
                if (entry.pending.size === 0) {
                    worker.unref();
                }
                return;
            }
            for (const [name, value] of Object.entries(response.counters ?? {})) {
                telemetry.add(name, value);
            }
            const pending = entry.pending.get(response.jobId);
            if (!pending) {
                return;
            }
            entry.pending.delete(response.jobId);
            if (entry.pending.size === 0) {
                worker.unref();
            }
            pending.release?.();
            if (response.ok) {
                pending.resolve(response.result ? Buffer.from(response.result) : undefined);
            } else {
                pending.reject(deserializeError(response.error));
            }
        });
        worker.on('error', error => retire(error.message));
        worker.on('exit', code => {
            const reason = `it exited with code ${code}`;
            retire(reason);
            for (const pending of entry.pending.values()) {
                pending.release?.();
                pending.reject(new WorkerFailedError(`A worker thread stopped while it processed a blob: ${reason}`));
            }
            entry.pending.clear();
        });
        return entry;
    }

    /** The thread with the fewest jobs; when the job downloads, one that can. */
    private pick(fetching: boolean): PoolWorker | undefined {
        let best: PoolWorker | undefined;
        for (const entry of this.workers) {
            if (entry.alive && (!fetching || entry.fetches) && (!best || entry.pending.size < best.pending.size)) {
                best = entry;
            }
        }
        return best;
    }

    /**
     * Hands the bytes of a blob to a thread; the buffer is transferred and unusable afterwards. Rejects with the error of the work,
     * with WorkerFailedError when the thread stopped, or with WorkerUnavailableError when no thread runs.
     */
    run(job: WorkerJob, body: Buffer): Promise<Buffer | undefined> {
        const entry = this.closed ? undefined : this.pick(false);
        if (!entry) {
            return Promise.reject(new WorkerUnavailableError('No worker thread is running.'));
        }

        const transferable = toTransferable(body);
        return this.submit(entry, job, { body: transferable }, [transferable]);
    }

    /**
     * Has a thread download the blob from its signed URL and do the work of the job with it. Rejects like `run`, with the errors of the
     * request (HttpError, timeouts and network errors with their codes) in place of the errors of the work, and with
     * WorkerUnavailableError when no thread can download. When `signal` aborts, the thread gives up the download; the job still ends with
     * the answer of the thread, so that a file the caller closes afterwards is not written to.
     */
    fetch(job: WorkerJob, url: string, signal?: AbortSignal): Promise<Buffer | undefined> {
        if (signal?.aborted) {
            return Promise.reject(new AbortedError());
        }
        const entry = this.closed ? undefined : this.pick(true);
        if (!entry) {
            return Promise.reject(new WorkerUnavailableError('No worker thread can download blobs.'));
        }
        return this.submit(entry, job, { url }, [], signal);
    }

    private submit(entry: PoolWorker, job: WorkerJob, content: { body?: ArrayBuffer; url?: string }, transfer: ArrayBuffer[], signal?: AbortSignal): Promise<Buffer | undefined> {
        const jobId = this.nextJobId++;
        return new Promise<Buffer | undefined>((resolve, reject) => {
            const pending: PendingJob = { resolve, reject };
            entry.pending.set(jobId, pending);
            if (entry.pending.size === 1) {
                entry.worker.ref();
            }
            if (signal) {
                const cancel = () => entry.worker.postMessage({ cancel: jobId } as WorkerCancel);
                signal.addEventListener('abort', cancel, { once: true });
                pending.release = () => signal.removeEventListener('abort', cancel);
            }
            try {
                const request: WorkerRequest = { jobId, job, ...content };
                entry.worker.postMessage(request, transfer);
            } catch (error) {
                pending.release?.();
                entry.pending.delete(jobId);
                if (entry.pending.size === 0) {
                    entry.worker.unref();
                }
                reject(new WorkerFailedError(`A blob could not be handed to a worker thread: ${(error as Error).message}`));
            }
        });
    }

    /** Stops the threads. Unfinished work fails with WorkerFailedError once its thread has stopped. */
    async close(): Promise<void> {
        this.closed = true;
        const workers = this.workers;
        this.workers = [];
        for (const entry of workers) {
            entry.alive = false;
        }
        await Promise.all(workers.map(entry => entry.worker.terminate().catch(() => undefined)));
        // Fails what the exit handlers have not failed already.
        for (const entry of workers) {
            for (const pending of entry.pending.values()) {
                pending.release?.();
                pending.reject(new WorkerFailedError('The worker threads were closed.'));
            }
            entry.pending.clear();
        }
    }
}

let shared: BlobWorkerPool | undefined;

/**
 * The pool that all downloads of the process share, so that the threads start once. `threads` is the configured count: undefined for
 * the machine default, 0 for none, in which case undefined is returned. `downloads` is the configured choice whether the threads download
 * the blobs: undefined for the machine default. The pool is not started; whoever uses it starts it.
 */
export function getSharedWorkerPool(threads?: number, downloads?: boolean): BlobWorkerPool | undefined {
    const size = threads === undefined || !Number.isFinite(threads) ? defaultWorkerThreads() : Math.min(MAX_WORKER_THREADS, Math.floor(threads));
    if (size < 1) {
        return undefined;
    }
    shared ??= new BlobWorkerPool(size, { downloads });
    return shared;
}

export async function closeSharedWorkerPool(): Promise<void> {
    const pool = shared;
    shared = undefined;
    await pool?.close();
}
