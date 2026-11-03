import * as assert from 'assert';
import { AbortedError } from '../src/errors';
import { delay, forEachLimit, Semaphore, withRetry } from '../src/util/concurrency';

describe('concurrency helpers', () => {
    it('limits the number of workers running at the same time', async () => {
        let running = 0;
        let maximum = 0;
        await forEachLimit(Array.from({ length: 40 }, (_, i) => i), 5, async () => {
            running++;
            maximum = Math.max(maximum, running);
            await delay(2);
            running--;
        });
        assert.strictEqual(maximum, 5);
    });

    it('stops scheduling after the first failure and rejects once running work settled', async () => {
        const started: number[] = [];
        let finished = 0;
        await assert.rejects(() => forEachLimit(Array.from({ length: 100 }, (_, i) => i), 4, async item => {
            started.push(item);
            await delay(5);
            if (item === 1) {
                throw new Error('boom');
            }
            finished++;
        }), /boom/);
        assert.ok(started.length < 100, 'no new work is started after a failure');
        assert.strictEqual(finished + 1, started.length, 'all started work settled before the rejection');
    });

    it('waits for running work when it is aborted', async () => {
        const controller = new AbortController();
        let completed = 0;
        const run = forEachLimit(Array.from({ length: 50 }, (_, i) => i), 3, async () => {
            await delay(20);
            completed++;
        }, controller.signal);
        setTimeout(() => controller.abort(), 30);
        await assert.rejects(() => run, AbortedError);
        const settled = completed;
        await delay(60);
        assert.strictEqual(completed, settled, 'nothing keeps running after the rejection');
        assert.ok(completed < 50);
    });

    it('retries with back off, honors a retry predicate and the server hint', async () => {
        let attempts = 0;
        const delays: number[] = [];
        const result = await withRetry(async () => {
            attempts++;
            if (attempts < 3) {
                throw new Error('transient');
            }
            return 'done';
        }, { retries: 3, baseDelayMs: 1, onRetry: (_error, _attempt, wait) => delays.push(wait) });
        assert.strictEqual(result, 'done');
        assert.strictEqual(delays.length, 2);

        attempts = 0;
        await assert.rejects(() => withRetry(async () => { attempts++; throw new Error('permanent'); }, { retries: 5, shouldRetry: () => false }), /permanent/);
        assert.strictEqual(attempts, 1);

        const hinted: number[] = [];
        attempts = 0;
        await withRetry(async () => { attempts++; if (attempts === 1) { throw new Error('busy'); } return 1; }, {
            retries: 1, baseDelayMs: 1, delayHint: () => 20, onRetry: (_e, _a, wait) => hinted.push(wait)
        });
        assert.ok(hinted[0] >= 20);
    });

    it('hands out semaphore permits in order', async () => {
        const semaphore = new Semaphore(1);
        const order: number[] = [];
        await Promise.all([1, 2, 3].map(n => semaphore.run(async () => { order.push(n); await delay(1); })));
        assert.deepStrictEqual(order, [1, 2, 3]);
    });
});
