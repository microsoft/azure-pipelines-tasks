import * as assert from 'assert';
import { renameWithRetry } from '../src/util/files';

function failure(code: string): NodeJS.ErrnoException {
    return Object.assign(new Error(code), { code });
}

describe('renameWithRetry', () => {
    it('retries a rename that a virus scanner or an indexer holds up on Windows', async () => {
        let calls = 0;
        await renameWithRetry('a', 'b', {
            platform: 'win32',
            baseDelayMs: 1,
            rename: async () => {
                if (++calls < 4) {
                    throw failure(['EPERM', 'EBUSY', 'EACCES'][calls - 1]);
                }
            }
        });
        assert.strictEqual(calls, 4);
    });

    it('gives up after the retries and fails at once for other errors', async () => {
        let calls = 0;
        await assert.rejects(() => renameWithRetry('a', 'b', {
            platform: 'win32',
            baseDelayMs: 1,
            retries: 3,
            rename: async () => { calls++; throw failure('EPERM'); }
        }), /EPERM/);
        assert.strictEqual(calls, 4);

        calls = 0;
        await assert.rejects(() => renameWithRetry('a', 'b', {
            platform: 'win32',
            baseDelayMs: 1,
            rename: async () => { calls++; throw failure('ENOENT'); }
        }), /ENOENT/);
        assert.strictEqual(calls, 1);
    });

    it('does not retry on other platforms', async () => {
        let calls = 0;
        await assert.rejects(() => renameWithRetry('a', 'b', {
            platform: 'linux',
            rename: async () => { calls++; throw failure('EPERM'); }
        }), /EPERM/);
        assert.strictEqual(calls, 1);
    });
});
