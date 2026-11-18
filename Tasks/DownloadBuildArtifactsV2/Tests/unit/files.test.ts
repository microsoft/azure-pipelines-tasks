import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { moveFile, renameSyncWithRetry, renameWithRetry } from '../../DownloadEngine/util/files';

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

describe('renameSyncWithRetry', () => {
    it('retries a rename that a virus scanner or an indexer holds up on Windows, and waits between the attempts', () => {
        let calls = 0;
        const waits: number[] = [];
        renameSyncWithRetry('a', 'b', {
            platform: 'win32',
            rename: () => {
                if (++calls < 4) {
                    throw failure(['EPERM', 'EBUSY', 'EACCES'][calls - 1]);
                }
            },
            sleep: milliseconds => waits.push(milliseconds)
        });
        assert.strictEqual(calls, 4);
        assert.strictEqual(waits.length, 3);
        assert.ok(waits.every(wait => wait > 0 && wait <= 1000));
    });

    it('gives up after the retries and fails at once for other errors and on other platforms', () => {
        let calls = 0;
        assert.throws(() => renameSyncWithRetry('a', 'b', { platform: 'win32', retries: 3, rename: () => { calls++; throw failure('EPERM'); }, sleep: () => undefined }), /EPERM/);
        assert.strictEqual(calls, 4);

        calls = 0;
        assert.throws(() => renameSyncWithRetry('a', 'b', { platform: 'win32', rename: () => { calls++; throw failure('ENOENT'); }, sleep: () => undefined }), /ENOENT/);
        assert.strictEqual(calls, 1);

        calls = 0;
        assert.throws(() => renameSyncWithRetry('a', 'b', { platform: 'linux', rename: () => { calls++; throw failure('EPERM'); } }), /EPERM/);
        assert.strictEqual(calls, 1);
    });
});

describe('moveFile', () => {
    let directory: string;
    const crossDevice = async () => { throw failure('EXDEV'); };

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'move-file-'));
    });

    afterEach(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    it('renames the file when it can', async () => {
        const from = path.join(directory, 'from.txt');
        const to = path.join(directory, 'to.txt');
        fs.writeFileSync(from, 'content');
        await moveFile(from, to);
        assert.strictEqual(fs.readFileSync(to, 'utf8'), 'content');
        assert.ok(!fs.existsSync(from));
    });

    it('copies the file and removes the original when the rename crosses file systems', async () => {
        const from = path.join(directory, 'from.txt');
        const to = path.join(directory, 'to.txt');
        fs.writeFileSync(from, 'content');
        await moveFile(from, to, { rename: crossDevice });
        assert.strictEqual(fs.readFileSync(to, 'utf8'), 'content');
        assert.ok(!fs.existsSync(from));
    });

    it('keeps the mode of a file that it copies', async function () {
        if (process.platform === 'win32') {
            this.skip();
            return;
        }
        const from = path.join(directory, 'run.sh');
        const to = path.join(directory, 'copied.sh');
        fs.writeFileSync(from, '#!/bin/sh\n');
        fs.chmodSync(from, 0o755);
        await moveFile(from, to, { rename: crossDevice });
        assert.strictEqual(fs.statSync(to).mode & 0o777, 0o755);
    });

    it('moves a symbolic link as a link, also when its target does not exist', async function () {
        if (process.platform === 'win32') {
            this.skip();
            return;
        }
        const from = path.join(directory, 'link');
        const to = path.join(directory, 'moved-link');
        fs.symlinkSync('missing/target.txt', from);
        await moveFile(from, to, { rename: crossDevice });
        assert.strictEqual(fs.readlinkSync(to), 'missing/target.txt');
        assert.ok(!fs.existsSync(from) && fs.lstatSync(to).isSymbolicLink() === true);
    });

    it('replaces what is at the destination, as a rename does, and does not write through a link that is there', async function () {
        if (process.platform === 'win32') {
            this.skip();
            return;
        }
        const from = path.join(directory, 'from.txt');
        const untouched = path.join(directory, 'untouched.txt');
        const to = path.join(directory, 'to.txt');
        fs.writeFileSync(from, 'new');
        fs.writeFileSync(untouched, 'old');
        fs.symlinkSync(untouched, to);
        await moveFile(from, to, { rename: crossDevice });
        assert.strictEqual(fs.readFileSync(to, 'utf8'), 'new');
        assert.ok(!fs.lstatSync(to).isSymbolicLink());
        assert.strictEqual(fs.readFileSync(untouched, 'utf8'), 'old');
    });

    it('fails for other errors and leaves the original', async () => {
        const from = path.join(directory, 'from.txt');
        fs.writeFileSync(from, 'content');
        await assert.rejects(() => moveFile(from, path.join(directory, 'to.txt'), { platform: 'linux', rename: async () => { throw failure('EPERM'); } }), /EPERM/);
        assert.strictEqual(fs.readFileSync(from, 'utf8'), 'content');
    });
});
