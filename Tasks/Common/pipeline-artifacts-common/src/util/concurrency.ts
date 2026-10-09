import { AbortedError } from '../errors';

export function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new AbortedError();
    }
}

export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new AbortedError());
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new AbortedError());
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

export class Semaphore {
    private available: number;
    private readonly waiters: Array<() => void> = [];

    constructor(permits: number) {
        if (!Number.isInteger(permits) || permits < 1) {
            throw new Error('A semaphore needs at least one permit.');
        }
        this.available = permits;
    }

    async acquire(): Promise<() => void> {
        if (this.available > 0) {
            this.available--;
        } else {
            await new Promise<void>(resolve => this.waiters.push(resolve));
        }
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            const next = this.waiters.shift();
            if (next) {
                next();
            } else {
                this.available++;
            }
        };
    }

    async run<T>(work: () => Promise<T>): Promise<T> {
        const release = await this.acquire();
        try {
            return await work();
        } finally {
            release();
        }
    }
}

/**
 * Runs `worker` over all items with at most `limit` running at the same time. Stops scheduling new work
 * after the first failure and rejects with that failure once the running work settled.
 */
export async function forEachLimit<T>(
    items: Iterable<T>,
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
    signal?: AbortSignal
): Promise<void> {
    const iterator = items[Symbol.iterator]();
    let index = 0;
    let failure: { error: unknown } | undefined;

    const runner = async (): Promise<void> => {
        while (!failure) {
            if (signal?.aborted) {
                failure = failure ?? { error: new AbortedError() };
                return;
            }
            const next = iterator.next();
            if (next.done) {
                return;
            }
            try {
                await worker(next.value, index++);
            } catch (error) {
                failure = failure ?? { error };
                return;
            }
        }
    };

    const runners: Promise<void>[] = [];
    for (let i = 0; i < Math.max(1, limit); i++) {
        runners.push(runner());
    }
    await Promise.all(runners);
    if (failure) {
        throw failure.error;
    }
}

export interface RetryOptions {
    retries: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
    delayHint?: (error: unknown) => number | undefined;
    signal?: AbortSignal;
}

export async function withRetry<T>(work: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
    const baseDelay = options.baseDelayMs ?? 500;
    const maxDelay = options.maxDelayMs ?? 15000;
    for (let attempt = 0; ; attempt++) {
        try {
            throwIfAborted(options.signal);
            return await work(attempt);
        } catch (error) {
            if (error instanceof AbortedError || attempt >= options.retries || (options.shouldRetry && !options.shouldRetry(error, attempt))) {
                throw error;
            }
            const backoff = Math.min(maxDelay, baseDelay * 2 ** attempt);
            const hint = Math.min(60000, options.delayHint?.(error) ?? 0);
            const wait = Math.max(hint, Math.round(backoff / 2 + Math.random() * backoff / 2));
            options.onRetry?.(error, attempt + 1, wait);
            await delay(wait, options.signal);
        }
    }
}

export class Lazy<T> {
    private promise: Promise<T> | undefined;

    constructor(private readonly factory: () => Promise<T>) { }

    get(): Promise<T> {
        if (!this.promise) {
            this.promise = this.factory().catch(error => {
                this.promise = undefined;
                throw error;
            });
        }
        return this.promise;
    }
}
