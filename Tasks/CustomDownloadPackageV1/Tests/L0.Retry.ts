import * as assert from 'assert';
import { Retry } from '../retry';

describe('DownloadPackageV1 L0 Suite - Retry Unit Behavior', function () {
    this.timeout(30000);

    let originalSetTimeout: typeof setTimeout;
    let observedTimeouts: number[];

    beforeEach(() => {
        observedTimeouts = [];
        originalSetTimeout = global.setTimeout;
        (global as any).setTimeout = (callback: (...args: any[]) => void, delay?: number) => {
            observedTimeouts.push(delay || 0);
            callback();
            return 0 as any;
        };
    });

    afterEach(() => {
        (global as any).setTimeout = originalSetTimeout;
    });

    it('retries failed operations and succeeds before max attempts', async () => {
        let attempts = 0;
        const executeWithRetries = Retry(2);

        const result = await executeWithRetries(async () => {
            attempts++;
            if (attempts < 3) {
                throw new Error('transient');
            }
            return 'ok';
        });

        assert.strictEqual(result, 'ok');
        assert.strictEqual(attempts, 3, 'Should attempt original call plus 2 retries');
        assert.deepStrictEqual(observedTimeouts, [100, 4000, 200, 4000]);
    });

    it('rejects immediately when retry count is zero', async () => {
        let attempts = 0;
        const executeWithRetries = Retry(0);

        await assert.rejects(
            async () => executeWithRetries(async () => {
                attempts++;
                throw new Error('fatal');
            }),
            /fatal/
        );

        assert.strictEqual(attempts, 1, 'Should call operation once with no retries');
        assert.deepStrictEqual(observedTimeouts, []);
    });
});