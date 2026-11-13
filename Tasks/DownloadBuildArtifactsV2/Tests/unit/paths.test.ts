import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UnsafePathError, assertLinksInside } from '../../DownloadEngine/util/paths';

describe('assertLinksInside', function () {
    let root: string;
    let outside: string;

    before(function () {
        if (process.platform === 'win32') {
            this.skip();
        }
    });

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'links-root-'));
        outside = fs.mkdtempSync(path.join(os.tmpdir(), 'links-outside-'));
        fs.mkdirSync(path.join(root, 'real', 'nested'), { recursive: true });
        fs.writeFileSync(path.join(root, 'real', 'file.txt'), 'file');
        fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(outside, { recursive: true, force: true });
    });

    it('accepts links that resolve inside of the directory, also to the directory itself', async () => {
        fs.symlinkSync(path.join('real', 'file.txt'), path.join(root, 'file-link'));
        fs.symlinkSync(path.join(root, 'real'), path.join(root, 'absolute-link'));
        fs.symlinkSync('..', path.join(root, 'real', 'nested', 'up'));
        fs.symlinkSync('.', path.join(root, 'self'));
        await assertLinksInside(root);
    });

    it('rejects a link to an absolute path outside of the directory', async () => {
        fs.symlinkSync(outside, path.join(root, 'escape'));
        await assert.rejects(() => assertLinksInside(root), (error: Error) => error instanceof UnsafePathError && /points outside of its folder/.test(error.message) && error.message.includes('escape'));
    });

    it('rejects a relative link that climbs out of the directory', async () => {
        fs.symlinkSync(path.relative(path.join(root, 'real'), path.join(outside, 'secret.txt')), path.join(root, 'real', 'climb'));
        await assert.rejects(() => assertLinksInside(root), UnsafePathError);
    });

    it('finds a link in a nested directory', async () => {
        fs.symlinkSync(outside, path.join(root, 'real', 'nested', 'deep-escape'));
        await assert.rejects(() => assertLinksInside(root), /deep-escape/);
    });

    it('rejects a link that cannot be resolved', async () => {
        fs.symlinkSync('missing', path.join(root, 'dangling'));
        await assert.rejects(() => assertLinksInside(root), /cannot be resolved/);
    });

    it('does not take a sibling directory whose name starts with the name of the directory for a place inside of it', async () => {
        const sibling = `${root}-sibling`;
        fs.mkdirSync(sibling);
        try {
            fs.symlinkSync(sibling, path.join(root, 'sibling-link'));
            await assert.rejects(() => assertLinksInside(root), /points outside of its folder/);
        } finally {
            fs.rmSync(sibling, { recursive: true, force: true });
        }
    });
});
