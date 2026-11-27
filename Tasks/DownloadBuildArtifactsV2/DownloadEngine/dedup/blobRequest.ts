import { RequestOptions } from '../http/httpClient';

/**
 * How a blob is requested, on the main thread and on a worker thread alike: the URL is signed, so no credentials are sent, and the
 * content is verified by its identifier, so it is received as it is stored. The caller repeats a failed attempt.
 */
export function blobRequestOptions(limit: number, signal?: AbortSignal): RequestOptions {
    return {
        authenticated: false,
        headers: { 'Accept-Encoding': 'identity' },
        maxResponseBytes: 2 * limit + 65536,
        retries: 0,
        signal
    };
}
