import { AbortedError, ArtifactError, HttpError, IntegrityError, ProtocolError } from '../errors';
import { HttpClientWorkerOptions, RequestTimeoutError } from '../http/httpClient';

/** What a worker thread is asked to do with one blob. The bytes of the blob travel with the request and are not copied, or the thread downloads them. */
export type WorkerJob =
    /** Verify (and decompress) the blob and write its content at a position of a file that the caller has open. */
    | { type: 'chunk'; id: string; size: number; limit: number; fd: number; position: number }
    /** Verify (and decompress) the blob and write its content to a new file: create the temporary file, write, check, close and rename it. */
    | { type: 'file'; id: string; size: number; limit: number; temporary: string; destination: string }
    /** Verify (and decompress) the blob and return its content. */
    | { type: 'decode'; id: string; size: number | undefined; limit: number };

/** What a worker thread is given when it starts. Without network settings it cannot download blobs. */
export interface WorkerData {
    http?: HttpClientWorkerOptions;
}

export interface WorkerRequest {
    jobId: number;
    job: WorkerJob;
    /** The bytes of the blob. */
    body?: ArrayBuffer;
    /** Instead of the bytes, the signed URL from which the thread downloads the blob. */
    url?: string;
}

/** The caller of a job gave up: the thread stops the download of that job and answers it with an error. */
export interface WorkerCancel {
    cancel: number;
}

export type WorkerMessage = WorkerRequest | WorkerCancel;

export interface SerializedError {
    name: string;
    message: string;
    code?: string;
    errno?: number;
    syscall?: string;
    path?: string;
    status?: number;
    requestId?: string;
    retryAfterMs?: number;
}

/** `counters` are the telemetry that the thread collected since its previous answer. */
export type WorkerResponse =
    | { ready: true }
    | { jobId: number; ok: true; result?: ArrayBuffer; counters?: Record<string, number> }
    | { jobId: number; ok: false; error: SerializedError; counters?: Record<string, number> };

export function serializeError(error: unknown): SerializedError {
    const failure = error as NodeJS.ErrnoException | undefined;
    const http = error instanceof HttpError ? error : undefined;
    return {
        name: failure?.name ?? 'Error',
        message: failure?.message ?? String(error),
        code: failure?.code,
        errno: typeof failure?.errno === 'number' ? failure.errno : undefined,
        syscall: failure?.syscall,
        path: failure?.path,
        status: http?.status,
        requestId: http?.requestId,
        retryAfterMs: http?.retryAfterMs
    };
}

/** Rebuilds an error that crossed from a worker thread, with the class and the properties the callers look at. */
export function deserializeError(serialized: SerializedError): Error {
    switch (serialized.name) {
        case 'IntegrityError': return new IntegrityError(serialized.message);
        case 'ProtocolError': return new ProtocolError(serialized.message);
        case 'ArtifactError': return new ArtifactError(serialized.message);
        case 'AbortedError': return new AbortedError(serialized.message);
        case 'RequestTimeoutError': return new RequestTimeoutError(serialized.message);
        case 'HttpError': return new HttpError(serialized.message, serialized.status ?? 0, serialized.requestId, undefined, serialized.retryAfterMs);
        default: {
            const error: NodeJS.ErrnoException = new Error(serialized.message);
            error.name = serialized.name;
            error.code = serialized.code;
            error.errno = serialized.errno;
            error.syscall = serialized.syscall;
            error.path = serialized.path;
            return error;
        }
    }
}

/** An ArrayBuffer that holds exactly the bytes of the buffer and can be handed to another thread. */
export function toTransferable(data: Uint8Array): ArrayBuffer {
    if (data.byteOffset === 0 && data.buffer instanceof ArrayBuffer && data.byteLength === data.buffer.byteLength) {
        return data.buffer;
    }
    const copy = new ArrayBuffer(data.byteLength);
    new Uint8Array(copy).set(data);
    return copy;
}
