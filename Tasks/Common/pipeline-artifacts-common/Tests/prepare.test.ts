import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { artifactPathSegments, leavesBase, resolveInside, UnsafePathError } from '../src/util/paths';
import { matchAnyPattern, matchPaths } from '../src/util/patterns';
import { listSource, listSourceFiles, prepareArtifact } from '../src/dedup/prepare';
import { MAX_MANIFEST_BYTES, buildManifest, checkManifestSize, estimateManifestBytes } from '../src/dedup/manifest';
import { DEDUP_1024K, DEDUP_64K } from '../src/dedup/chunker';
import { Logger } from '../src/util/logger';
import { seeded } from './testUtil';

const warnings: string[] = [];
const logger: Logger = { debug: () => undefined, info: () => undefined, warning: m => warnings.push(m), error: () => undefined };

function tree(files: Record<string, string | Buffer>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pac-prep-'));
    for (const [relative, content] of Object.entries(files)) {
        const target = path.join(root, ...relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
    return root;
}

describe('pattern matching', () => {
    const paths = ['a/b.txt', 'a/c.js', 'a/.hidden', 'd/e.TXT', 'f.txt'];
    const caseSensitive = { dot: true, nobrace: true, nocase: false };

    it('adds matches of include patterns and removes matches of exclusion patterns in order', () => {
        assert.deepStrictEqual(matchPaths(paths, ['**/*.txt'], caseSensitive), ['a/b.txt', 'f.txt']);
        assert.deepStrictEqual(matchPaths(paths, ['**', '!**/*.js'], caseSensitive), ['a/b.txt', 'a/.hidden', 'd/e.TXT', 'f.txt']);
        assert.deepStrictEqual(matchPaths(paths, ['!**/*.js', '**'], caseSensitive), paths);
        assert.deepStrictEqual(matchPaths(paths, ['a/**', '!a/b.txt', 'a/b.txt'], caseSensitive), ['a/b.txt', 'a/c.js', 'a/.hidden']);
    });

    it('matches dot files, ignores comments and empty patterns, and honors the case option', () => {
        assert.deepStrictEqual(matchPaths(paths, ['a/*']), ['a/b.txt', 'a/c.js', 'a/.hidden']);
        assert.deepStrictEqual(matchPaths(paths, ['# comment', '', '   ', 'f.txt']), ['f.txt']);
        assert.deepStrictEqual(matchPaths(paths, ['d/*.txt'], { dot: true, nobrace: true, nocase: false }), []);
        assert.deepStrictEqual(matchPaths(paths, ['d/*.txt'], { dot: true, nobrace: true, nocase: true }), ['d/e.TXT']);
    });

    it('treats several leading negations like the agent plugins', () => {
        assert.deepStrictEqual(matchPaths(paths, ['!!f.txt']), ['f.txt']);
        assert.deepStrictEqual(matchPaths(['x'], ['x', '!!!x']), []);
    });

    it('trims patterns like string.Trim of .NET: U+0085 is white space', () => {
        assert.deepStrictEqual(matchPaths(paths, ['\u0085f.txt\u2003', '! \u0085a/b.txt']), ['f.txt']);
        assert.deepStrictEqual(matchPaths(paths, ['**', '!\u0085a/**\u0085']), ['d/e.TXT', 'f.txt']);
    });

    it('expands braces only when allowed', () => {
        assert.deepStrictEqual(matchPaths(paths, ['**/*.{txt,js}'], { dot: true, nobrace: true, nocase: false }), []);
        assert.deepStrictEqual(matchPaths(paths, ['**/*.{txt,js}'], { dot: true, nobrace: false, nocase: false }), ['a/b.txt', 'a/c.js', 'f.txt']);
    });
});

describe('artifact paths', () => {
    it('splits valid paths and rejects traversal and invalid names', () => {
        assert.deepStrictEqual(artifactPathSegments('/a/b/c.txt'), ['a', 'b', 'c.txt']);
        for (const bad of ['/..', '/a/../b', '/a//b', '/./a', '', '/', '/a/\u0000b']) {
            assert.throws(() => artifactPathSegments(bad), UnsafePathError, bad);
        }
        assert.throws(() => artifactPathSegments('/CON', 'win32'), UnsafePathError);
        assert.throws(() => artifactPathSegments('/a:b', 'win32'), UnsafePathError);
        assert.throws(() => artifactPathSegments('/a\\..\\b', 'win32'), UnsafePathError);
        assert.throws(() => artifactPathSegments('/trailing.', 'win32'), UnsafePathError);
        assert.deepStrictEqual(artifactPathSegments('/a\\b', 'linux'), ['a\\b']);
    });

    it('keeps resolved paths inside the root', () => {
        const root = path.resolve(os.tmpdir(), 'root');
        assert.strictEqual(resolveInside(root, ['a', 'b']), path.join(root, 'a', 'b'));
        assert.throws(() => resolveInside(root, ['..', 'x']), UnsafePathError);
    });

    it('accepts names that merely start with two dots', () => {
        const root = path.resolve(os.tmpdir(), 'root');
        assert.strictEqual(resolveInside(root, ['..twodots']), path.join(root, '..twodots'));
        assert.strictEqual(resolveInside(root, ['dir', '..data', 'f']), path.join(root, 'dir', '..data', 'f'));
        assert.deepStrictEqual(artifactPathSegments('/..twodots'), ['..twodots']);
        assert.strictEqual(leavesBase('..'), true);
        assert.strictEqual(leavesBase('..' + path.sep + 'x'), true);
        assert.strictEqual(leavesBase('..twodots'), false);
    });
});

describe('artifact preparation', () => {
    afterEach(() => { warnings.length = 0; });

    it('orders files ordinally and uses artifact paths relative to the source', async () => {
        const root = tree({ 'b.txt': 'b', 'Z.txt': 'Z', 'a/z.txt': 'z', 'a.txt': 'a', 'a-b/c.txt': 'c', '.hidden': 'h' });
        try {
            const files = await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K' });
            assert.deepStrictEqual(files.map(file => file.relativePath), ['.hidden', 'Z.txt', 'a-b/c.txt', 'a.txt', 'a/z.txt', 'b.txt']);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('publishes a single file under its own name', async () => {
        const root = tree({ 'one.bin': Buffer.from('xyz') });
        try {
            const prepared = await prepareArtifact({ sourcePath: path.join(root, 'one.bin'), hashType: 'Dedup1024K', logger });
            assert.deepStrictEqual(prepared.items.map(item => item.path), ['/one.bin']);
            assert.strictEqual(prepared.contentSize, 3);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('references every distinct file blob once from the content root and keeps all files in the manifest', async () => {
        const root = tree({ 'a.txt': 'same', 'b.txt': 'same', 'c.txt': 'other', 'empty1': '', 'empty2': '' });
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger });
            assert.strictEqual(prepared.items.length, 5);
            assert.strictEqual(prepared.nodes.get(prepared.contentRoot!.id)!.children.length, 3);
            assert.strictEqual(prepared.contentSize, 4 + 4 + 5);
            assert.deepStrictEqual(prepared.manifest, buildManifest(prepared.items));
            assert.strictEqual(prepared.proofs.length, 2);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('gives the same artifact identifiers independent of the traversal order', async () => {
        const files = { 'x/1.bin': seeded('1', 100000), 'x/2.bin': seeded('2', 50), 'y.bin': seeded('3', 3000000) };
        const first = tree(files);
        const second = tree(Object.fromEntries(Object.entries(files).reverse()));
        try {
            const a = await prepareArtifact({ sourcePath: first, hashType: 'Dedup1024K', logger });
            const b = await prepareArtifact({ sourcePath: second, hashType: 'Dedup1024K', logger });
            assert.strictEqual(a.manifestRoot.id, b.manifestRoot.id);
            assert.strictEqual(a.superRoot.id, b.superRoot.id);
            const c = await prepareArtifact({ sourcePath: first, hashType: 'Dedup64K', logger });
            assert.notStrictEqual(a.superRoot.id, c.superRoot.id);
        } finally {
            fs.rmSync(first, { recursive: true, force: true });
            fs.rmSync(second, { recursive: true, force: true });
        }
    });

    it('publishes .gitignore files like any other file, but leaves out the .git directory unless an .artifactignore exists', async () => {
        const without = tree({ '.gitignore': '*.log\n', 'sub/.gitignore': 'y', 'a.log': 'l', 'keep.txt': 'k', '.git/HEAD': 'ref', 'sub/.git/config': 'c', '.gitx/file.txt': 'x' });
        const withIgnore = tree({ '.artifactignore': '', '.gitignore': 'x', '.git/HEAD': 'ref', 'keep.txt': 'k' });
        try {
            assert.deepStrictEqual(
                (await listSourceFiles({ sourcePath: without, hashType: 'Dedup64K', logger })).map(f => f.relativePath),
                ['.gitignore', '.gitx/file.txt', 'a.log', 'keep.txt', 'sub/.gitignore']);
            assert.deepStrictEqual(
                (await listSourceFiles({ sourcePath: withIgnore, hashType: 'Dedup64K', logger })).map(f => f.relativePath),
                ['.artifactignore', '.git/HEAD', '.gitignore', 'keep.txt']);
        } finally {
            fs.rmSync(without, { recursive: true, force: true });
            fs.rmSync(withIgnore, { recursive: true, force: true });
        }
    });

    it('applies the .artifactignore example of the documentation: ignore everything, re-include a folder and a file', async () => {
        const root = tree({
            '.artifactignore': '**/*\n!dist/\n!dist/**\n!package.json\n',
            'dist/app.js': 'a', 'dist/sub/lib.js': 'b', 'package.json': '{}', 'src/main.ts': 'c', 'other.txt': 'd'
        });
        try {
            const files = (await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K', logger })).map(f => f.relativePath);
            assert.deepStrictEqual(files, ['dist/app.js', 'dist/sub/lib.js', 'package.json']);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    // The identifiers in the next tests are the ones the in-box PublishPipelineArtifact@1 task produced in an
    // organization that uses the 1 MiB chunker, for exactly this data.
    function directories(root: string, ...relative: string[]): void {
        for (const directory of relative) {
            fs.mkdirSync(path.join(root, ...directory.split('/')), { recursive: true });
        }
    }

    const WINDOWS = { ignoreCase: true, windows: true };
    const LINUX = { ignoreCase: false, windows: false };

    it('lists directories without any content as EmptyDirectory items, except the ignored ones (same artifact as the plugin on Windows)', async () => {
        const root = tree({ '.artifactignore': 'skipme/\n', 'file.txt': 'f' });
        directories(root, 'skipme', 'keepme', 'parent/skipme', 'parent/keepme');
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger, artifactIgnoreFlavor: WINDOWS });
            assert.deepStrictEqual(prepared.items.map(item => item.path + (item.type ? ':' + item.type : '')),
                ['/.artifactignore', '/file.txt', '/keepme:EmptyDirectory', '/parent/keepme:EmptyDirectory']);
            assert.strictEqual(prepared.contentSize, 9);
            assert.strictEqual(prepared.manifestRoot.id, '7074F58E08A0ADEACA90905DC9E3FFCB9234047DB68E4A0EDA3048E4BC8141BE01');
            // The empty blob stands for the empty directories in the content root.
            assert.strictEqual(prepared.nodes.get(prepared.contentRoot!.id)!.children.length, 3);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('anchors "skipme/" at the root on Linux, so that only the root level directory is ignored (same artifact as the plugin on Linux)', async () => {
        const root = tree({ '.artifactignore': 'skipme/\n', 'file.txt': 'f' });
        directories(root, 'skipme', 'keepme', 'parent/skipme', 'parent/keepme');
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger, artifactIgnoreFlavor: LINUX });
            assert.deepStrictEqual(prepared.items.map(item => item.path + (item.type ? ':' + item.type : '')),
                ['/.artifactignore', '/file.txt', '/keepme:EmptyDirectory', '/parent/keepme:EmptyDirectory', '/parent/skipme:EmptyDirectory']);
            assert.strictEqual(prepared.manifestRoot.id, 'A09B0210DFD564F565B8EA17E026AC673E8BA2F144B2D6986BBDA1615818647101');
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
    it('does not report a directory that only contains ignored files as empty (same artifact as the plugin)', async () => {
        const root = tree({ '.artifactignore': '*.tmp\n', 'd/file.txt': 'd', 'onlyignored/x.tmp': 'tmp' });
        directories(root, 'emptydir', 'a/b/c', 'd/emptysub', 'Emptydir2');
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger, artifactIgnoreFlavor: process.platform === 'win32' ? WINDOWS : LINUX });
            assert.deepStrictEqual(prepared.items.map(item => item.path),
                ['/.artifactignore', '/Emptydir2', '/a/b/c', '/d/emptysub', '/d/file.txt', '/emptydir']);
            assert.strictEqual(prepared.manifestRoot.id, '4090A0544B304CD867A1A5702189E0C1D4FA49A8466029668332B91B6F8928DE01');
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('ignores nothing but publishes the files of .gitignore (same artifact as the plugin)', async () => {
        const root = tree({
            '.gitignore': '*.ignored\nbuild/\n!keep.ignored\n', 'a.txt': 'a', 'x.ignored': 'x', 'keep.ignored': 'keep', 'build/out.txt': 'out',
            'sub/.gitignore': '*.log\n', 'sub/a.log': 'log', 'sub/b.txt': 'b', 'sub/deep/c.log': 'deep log', 'sub/deep/d.ignored': 'deep ignored'
        });
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger });
            assert.strictEqual(prepared.items.length, 10);
            assert.strictEqual(prepared.manifestRoot.id, 'B4008E8B056B3985DA73A1C535A472E58462A594C65B83A7BCA9AB102969DAF501');
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('publishes an artifact without items when everything is ignored, as the plugin does', async () => {
        const root = tree({ '.artifactignore': '**/*\n', 'a.txt': 'a', 'sub/b.txt': 'b' });
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger });
            assert.deepStrictEqual(prepared.items, []);
            assert.strictEqual(prepared.contentRoot, undefined);
            assert.strictEqual(prepared.contentSize, 0);
            assert.strictEqual(prepared.manifest.toString('utf8'), '{"manifestFormat":"1.1.0","items":[],"manifestReferences":[]}');
            assert.strictEqual(prepared.manifestRoot.id, 'B52D983C641AD70E6622EDA19918E27E4C0B27F3C0C705A101FA3B6D9CE1A45001');
            assert.strictEqual(prepared.superRoot.id, '6F99FA7CFEEFBF2982B0285FCD47966DDFCB47970EF0E223E9B82C3B57BFE73302');
            assert.strictEqual(prepared.proofs.length, 1);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('lists the empty directories separately from the files', async () => {
        const root = tree({ 'a.txt': 'a' });
        directories(root, 'e1', 'x/e2');
        try {
            const listing = await listSource({ sourcePath: root, hashType: 'Dedup64K', logger });
            assert.deepStrictEqual(listing.files.map(f => f.relativePath), ['a.txt']);
            assert.deepStrictEqual(listing.emptyDirectories, ['e1', 'x/e2']);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('follows symbolic links (also to the outside), skips broken links and link cycles, and can skip links to the outside', async function () {
        const root = tree({ 'real/data.txt': 'data', 'plain.txt': 'plain' });
        const outside = tree({ 'outside.txt': 'outside' });
        try {
            try {
                fs.symlinkSync(path.join(root, 'plain.txt'), path.join(root, 'link-file.txt'));
                fs.symlinkSync(path.join(root, 'real'), path.join(root, 'link-dir'), 'junction');
                fs.symlinkSync(outside, path.join(root, 'external-dir'), 'junction');
                fs.symlinkSync(path.join(outside, 'outside.txt'), path.join(root, 'external-file.txt'));
                fs.symlinkSync(path.join(root, 'missing'), path.join(root, 'broken'));
                fs.symlinkSync(root, path.join(root, 'real', 'cycle'), 'junction');
            } catch {
                this.skip();
            }
            // Like the plugin, every link is followed by default, also the ones that point outside of the source.
            const files = (await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K', logger })).map(f => f.relativePath).sort();
            assert.deepStrictEqual(files, ['external-dir/outside.txt', 'external-file.txt', 'link-dir/data.txt', 'link-file.txt', 'plain.txt', 'real/data.txt']);
            assert.ok(warnings.some(message => /broken symbolic link/.test(message)));
            assert.ok(warnings.some(message => /points to one of its parent directories/.test(message)), 'link cycles are reported');

            warnings.length = 0;
            const contained = (await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K', logger, skipExternalSymlinks: true })).map(f => f.relativePath).sort();
            assert.deepStrictEqual(contained, ['link-dir/data.txt', 'link-file.txt', 'plain.txt', 'real/data.txt']);
            assert.ok(warnings.some(message => /is outside of/.test(message)), 'links to the outside are reported');

            const noLinks = (await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K', logger, followSymlinks: false })).map(f => f.relativePath).sort();
            assert.deepStrictEqual(noLinks, ['plain.txt', 'real/data.txt']);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
            fs.rmSync(outside, { recursive: true, force: true });
        }
    });

    it('publishes the bytes that were read when a file grows while it is processed', async () => {
        const root = tree({ 'log.txt': 'first line\n' });
        try {
            const [file] = await listSourceFiles({ sourcePath: root, hashType: 'Dedup64K', logger });
            fs.appendFileSync(path.join(root, 'log.txt'), 'appended later\n');
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger });
            assert.strictEqual(prepared.files[0].size, 'first line\nappended later\n'.length);
            assert.strictEqual(prepared.contentSize, prepared.files[0].size);
            assert.strictEqual(file.size, 'first line\n'.length);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
    it('uses the chunk sizes of the configured hash type', async () => {
        const root = tree({ 'big.bin': seeded('big', 6 * 1024 * 1024) });
        try {
            const small = await prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger });
            const large = await prepareArtifact({ sourcePath: root, hashType: 'Dedup1024K', logger });
            assert.ok(small.chunks.size > large.chunks.size * 4);
            assert.ok([...large.chunks.values()].every(location => location.size <= DEDUP_1024K.maxChunk));
            assert.ok([...small.chunks.values()].every(location => location.size <= DEDUP_64K.maxChunk));
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('estimates the manifest of a listing from below and refuses artifacts whose manifest is too large before any file is read', async () => {
        const root = tree({ 'a.txt': 'a', 'dir/b.txt': 'b', 'dir/\u00fcn\u00efc\u00f6de \u2713.txt': 'c', 'x/empty-1/.keep': '' });
        fs.mkdirSync(path.join(root, 'x', 'empty-2'));
        try {
            const prepared = await prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger });
            const listing = await listSource({ sourcePath: root, hashType: 'Dedup64K', logger });
            const estimate = estimateManifestBytes(listing.files.map(file => '/' + file.relativePath), listing.emptyDirectories.map(directory => '/' + directory));
            assert.ok(listing.emptyDirectories.length > 0);
            assert.ok(estimate <= prepared.manifest.length && estimate > prepared.manifest.length * 0.6, `${estimate} of ${prepared.manifest.length}`);

            await assert.rejects(() => prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger, maxManifestBytes: estimate - 1 }), /too many files/);
            await assert.rejects(() => prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger, maxManifestBytes: prepared.manifest.length - 1 }), /too many files/);
            const accepted = await prepareArtifact({ sourcePath: root, hashType: 'Dedup64K', logger, maxManifestBytes: prepared.manifest.length });
            assert.deepStrictEqual(accepted.manifest, prepared.manifest);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });

    it('allows manifests of up to 256 MiB, which is about two million files', () => {
        assert.strictEqual(MAX_MANIFEST_BYTES, 256 * 1024 * 1024);
        const paths = Array.from({ length: 1000 }, (_, index) => `/folder/sub-folder/file-${index}.txt`);
        const perFile = estimateManifestBytes(paths, []) / paths.length;
        assert.ok(MAX_MANIFEST_BYTES / perFile > 1500000);
        checkManifestSize(MAX_MANIFEST_BYTES);
        assert.throws(() => checkManifestSize(MAX_MANIFEST_BYTES + 1), /too many files.*256 MiB/);
    });
});
