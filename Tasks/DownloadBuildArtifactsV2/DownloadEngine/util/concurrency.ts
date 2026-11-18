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

/**
 * A counting semaphore whose work can take more than one permit, for a limit that counts something other than tasks (megabytes, say).
 * Waiters are served in order, so heavy work is not starved by light work.
 */
export class Semaphore {
    private available: number;
    private readonly waiters: Array<{ permits: number; wake: () => void }> = [];

    constructor(private readonly capacity: number) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new Error('A semaphore needs at least one permit.');
        }
        this.available = capacity;
    }

    /** Resolves to the function that gives the permits back. Work that is heavier than the semaphore takes all of it. */
    async acquire(permits: number = 1): Promise<() => void> {
        const needed = Math.min(this.capacity, Math.max(1, Math.floor(permits)));
        if (this.waiters.length === 0 && this.available >= needed) {
            this.available -= needed;
        } else {
            await new Promise<void>(resolve => this.waiters.push({ permits: needed, wake: resolve }));
        }
        return this.releaseFunction(needed);
    }

    /** Like acquire, but returns undefined at once when the permits are not free. */
    tryAcquire(permits: number = 1): (() => void) | undefined {
        const needed = Math.min(this.capacity, Math.max(1, Math.floor(permits)));
        if (this.waiters.length > 0 || this.available < needed) {
            return undefined;
        }
        this.available -= needed;
        return this.releaseFunction(needed);
    }

    private releaseFunction(needed: number): () => void {
        let released = false;
        return () => {
            if (released) {
                return;
            }
            released = true;
            this.available += needed;
            while (this.waiters.length > 0 && this.available >= this.waiters[0].permits) {
                const next = this.waiters.shift()!;
                this.available -= next.permits;
                next.wake();
            }
        };
    }

    async run<T>(work: () => Promise<T>, permits: number = 1): Promise<T> {
        const release = await this.acquire(permits);
        try {
            return await work();
        } finally {
            release();
        }
    }
}

/**
 * Runs `worker` over all items, at most `limit` at a time. After the first failure no new work starts, and that failure is
 * rejected once the running work has settled.
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
