import * as assert from 'assert';
import { AbortedError } from '../../DownloadEngine/errors';
import { delay, forEachLimit, Semaphore, withRetry } from '../../DownloadEngine/util/concurrency';

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

    it('counts work that takes several permits, serves it in order and lets work that is too heavy run alone', async () => {
        const semaphore = new Semaphore(10);
        let used = 0;
        let peak = 0;
        const order: string[] = [];
        const job = (name: string, permits: number, milliseconds: number) => semaphore.run(async () => {
            const taken = Math.min(permits, 10);
            order.push(name);
            used += taken;
            peak = Math.max(peak, used);
            await delay(milliseconds);
            used -= taken;
        }, permits);

        await Promise.all([job('a', 6, 10), job('b', 6, 10), job('c', 3, 10), job('d', 3, 10), job('heavy', 50, 10), job('e', 1, 1)]);
        // Work is served in the order it arrived: 'c' does not pass 'b', although it would fit next to 'a'.
        assert.deepStrictEqual(order, ['a', 'b', 'c', 'd', 'heavy', 'e']);
        assert.ok(peak <= 10, `at most the 10 permits are in use: ${peak}`);
        assert.strictEqual(used, 0);
    });

    it('does not let work that needs many permits starve behind work that needs few', async () => {
        const semaphore = new Semaphore(4);
        const first = await semaphore.acquire(3);
        let heavyStarted = false;
        const heavy = semaphore.acquire(3).then(release => { heavyStarted = true; return release; });
        let lightStarted = false;
        const light = semaphore.acquire(1).then(release => { lightStarted = true; return release; });
        await delay(10);
        assert.strictEqual(heavyStarted, false);
        assert.strictEqual(lightStarted, false, 'one permit is free, but the heavy work that waits is first');
        first();
        (await heavy)();
        (await light)();
        assert.strictEqual(heavyStarted && lightStarted, true);
    });

    it('gives permits back once, however often the release is called', async () => {
        const semaphore = new Semaphore(2);
        const release = await semaphore.acquire(2);
        release();
        release();
        const again = await semaphore.acquire(2);
        let waited = true;
        const next = semaphore.acquire(1).then(r => { waited = false; return r; });
        await delay(5);
        assert.strictEqual(waited, true, 'the second release did not hand out permits that nobody returned');
        again();
        (await next)();
    });

    it('hands out semaphore permits in order', async () => {
        const semaphore = new Semaphore(1);
        const order: number[] = [];
        await Promise.all([1, 2, 3].map(n => semaphore.run(async () => { order.push(n); await delay(1); })));
        assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('takes permits without waiting only when they are free, and does not overtake work that waits', async () => {
        const semaphore = new Semaphore(4);
        const first = semaphore.tryAcquire(3);
        assert.ok(first, 'three of four permits are free');
        assert.strictEqual(semaphore.tryAcquire(2), undefined, 'two are not');
        const second = semaphore.tryAcquire(1);
        assert.ok(second, 'one is');
        assert.strictEqual(semaphore.tryAcquire(1), undefined, 'none is left');

        // Work that waits is served first, so a try cannot take the permits that it needs.
        let waiting = false;
        const waited = semaphore.acquire(4).then(release => { waiting = true; return release; });
        first!();
        await delay(5);
        assert.strictEqual(waiting, false, 'it needs four permits and one is still taken');
        assert.strictEqual(semaphore.tryAcquire(1), undefined, 'a try does not overtake the work that waits');
        second!();
        const release = await waited;
        assert.strictEqual(waiting, true);
        assert.strictEqual(semaphore.tryAcquire(1), undefined, 'the permits that the work holds are not free');
        release();
        const everything = semaphore.tryAcquire(4);
        assert.ok(everything, 'everything is free once the work is done');
        everything!();
    });

    it('gives permits that were taken without waiting back once, however often the release is called', () => {
        const semaphore = new Semaphore(2);
        const release = semaphore.tryAcquire(2)!;
        release();
        release();
        assert.ok(semaphore.tryAcquire(2));
        assert.strictEqual(semaphore.tryAcquire(1), undefined);
    });
});
