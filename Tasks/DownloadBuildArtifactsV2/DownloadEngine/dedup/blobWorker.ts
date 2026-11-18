import * as fs from 'fs';
import * as path from 'path';
import { parentPort, workerData } from 'worker_threads';
import { IntegrityError } from '../errors';
import { HttpClient } from '../http/httpClient';
import { nullLogger } from '../util/logger';
import { renameSyncWithRetry } from '../util/files';
import { telemetry } from '../util/telemetry';
import { decodeBlob } from './blobCodec';
import { blobRequestOptions } from './blobRequest';
import { WorkerData, WorkerJob, WorkerMessage, WorkerRequest, WorkerResponse, serializeError, toTransferable } from './blobWorkerProtocol';

/*
 * Entry of the BlobWorkerPool threads: downloads a blob (unless the bytes come with the request), verifies and decompresses it, and writes
 * its content with synchronous file calls. Requests, hashing and blocking calls would otherwise hold up the one thread of the main thread.
 */

function writeFully(fd: number, data: Buffer, position: number): void {
    let written = 0;
    while (written < data.length) {
        const count = fs.writeSync(fd, data, written, data.length - written, position + written);
        if (count <= 0) {
            throw new IntegrityError('A file write made no progress.');
        }
        written += count;
    }
}

function writeNewFile(data: Buffer, temporary: string, destination: string): void {
    let fd: number | undefined;
    try {
        fd = fs.openSync(temporary, 'w');
        writeFully(fd, data, 0);
        if (fs.fstatSync(fd).size !== data.length) {
            throw new IntegrityError(`The file '${path.basename(destination)}' was not written completely.`);
        }
        fs.closeSync(fd);
        fd = undefined;
        renameSyncWithRetry(temporary, destination);
    } catch (error) {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // The original failure is the one to report.
            }
        }
        try {
            fs.unlinkSync(temporary);
        } catch {
            // The temporary file may not exist.
        }
        throw error;
    }
}

function run(job: WorkerJob, body: Buffer): Buffer | undefined {
    const data = decodeBlob(body, job.id, job.size, job.limit);
    switch (job.type) {
        case 'chunk':
            writeFully(job.fd, data, job.position);
            return undefined;
        case 'file':
            writeNewFile(data, job.temporary, job.destination);
            return undefined;
        default:
            return data;
    }
}

if (!parentPort) {
    throw new Error('This file is the entry of a worker thread.');
}
const port = parentPort;

let client: HttpClient | undefined;

function httpClient(): HttpClient {
    const options = (workerData as WorkerData | null)?.http;
    if (!options) {
        throw new Error('This worker thread has no network settings.');
    }
    client ??= new HttpClient({ ...options, logger: nullLogger });
    return client;
}

const downloads = new Map<number, AbortController>();

async function bodyOf(request: WorkerRequest): Promise<Buffer> {
    if (request.url === undefined) {
        if (!request.body) {
            throw new Error('A request holds neither the bytes of a blob nor a URL.');
        }
        return Buffer.from(request.body);
    }
    const controller = new AbortController();
    downloads.set(request.jobId, controller);
    try {
        return (await httpClient().request(request.url, blobRequestOptions(request.job.limit, controller.signal))).body;
    } finally {
        downloads.delete(request.jobId);
    }
}

async function handle(request: WorkerRequest): Promise<void> {
    let response: WorkerResponse;
    const transfer: ArrayBuffer[] = [];
    try {
        const result = run(request.job, await bodyOf(request));
        if (result) {
            const content = toTransferable(result);
            transfer.push(content);
            response = { jobId: request.jobId, ok: true, result: content };
        } else {
            response = { jobId: request.jobId, ok: true };
        }
    } catch (error) {
        response = { jobId: request.jobId, ok: false, error: serializeError(error) };
    }
    const counters = telemetry.snapshot();
    if (Object.keys(counters).length > 0) {
        telemetry.reset();
        response.counters = counters;
    }
    port.postMessage(response, transfer);
}

port.on('message', (message: WorkerMessage) => {
    if ('cancel' in message) {
        downloads.get(message.cancel)?.abort();
    } else {
        void handle(message);
    }
});

port.postMessage({ ready: true } as WorkerResponse);
