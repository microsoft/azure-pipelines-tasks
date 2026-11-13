import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BlobReader } from '../../DownloadEngine/dedup/blobReader';
import { DEFAULT_FILE_CONCURRENCY, DEFAULT_MAX_BUFFERED_CHUNKS, URL_LOOKAHEAD_CHUNKS_MAX, URL_LOOKAHEAD_CHUNKS_MIN, URL_LOOKAHEAD_FILES, chunkConcurrencyFor, chunkLookaheadWindow, downloadManifestArtifact } from '../../DownloadEngine/dedup/download';
import { BlobRef, EMPTY_CHUNK_ID, chunkIdOf } from '../../DownloadEngine/dedup/hashing';
import { EMPTY_DIRECTORY_TYPE, ManifestItem } from '../../DownloadEngine/dedup/manifest';
import { buildManifest } from './artifactWriter';

class CountingReader {
    private inFlight = 0;
    peak = 0;

    constructor(private readonly manifest: Buffer, private readonly contents: Map<string, Buffer>, private readonly delayMs: number) { }

    async readManifest(): Promise<Buffer> {
        return this.manifest;
    }

    async leaves(ref: BlobRef): Promise<BlobRef[]> {
        return [{ id: ref.id, size: ref.size }];
    }

    async getBlob(id: string): Promise<Buffer> {
        this.peak = Math.max(this.peak, ++this.inFlight);
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
        this.inFlight--;
        return this.contents.get(id)!;
    }
}

function artifactOf(count: number, delayMs: number): { reader: CountingReader; names: string[] } {
    const contents = new Map<string, Buffer>();
    const items = Array.from({ length: count }, (_, index) => {
        const data = Buffer.from(`content of file ${index}`);
        const id = chunkIdOf(data);
        contents.set(id, data);
        return { path: `/dir/file-${index}.txt`, blob: { id, size: data.length } };
    });
    return { reader: new CountingReader(buildManifest(items), contents, delayMs), names: items.map(item => item.path) };
}

describe('manifest download', function () {
    this.timeout(60000);

    let target: string;

    beforeEach(() => {
        target = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-download-'));
    });

    afterEach(() => {
        fs.rmSync(target, { recursive: true, force: true });
    });

    function chunkedArtifact(files: number, leavesPerFile: number, fetchMs: number, onFetch: (call: number) => Promise<void> | void = () => undefined, bytes: number = 64) {
        const items = Array.from({ length: files }, (_, index) => ({
            path: `/dir/file-${index}.bin`,
            blob: { id: 'A'.repeat(64) + '02', size: leavesPerFile * bytes }
        }));
        const state = { calls: 0, fetching: 0, peakFetching: 0, held: 0, peakHeld: 0 };
        const reader = {
            async readManifest() { return buildManifest(items); },
            async leaves(): Promise<BlobRef[]> {
                return Array.from({ length: leavesPerFile }, (_, index) => ({ id: 'B'.repeat(62) + index.toString(16).padStart(2, '0') + '01', size: bytes }));
            },
            async getBlob(_id: string, size: number): Promise<Buffer> {
                const call = ++state.calls;
                state.peakFetching = Math.max(state.peakFetching, ++state.fetching);
                try {
                    await onFetch(call);
                    await new Promise(resolve => setTimeout(resolve, fetchMs));
                } finally {
                    state.fetching--;
                }
                state.peakHeld = Math.max(state.peakHeld, ++state.held);
                return Buffer.alloc(size, 1);
            }
        };
        return { reader: reader as unknown as BlobReader, state };
    }

    it('downloads up to 128 files at a time unless told otherwise, so that many small files keep the connections busy', async () => {
        assert.strictEqual(DEFAULT_FILE_CONCURRENCY, 128);
        const { reader, names } = artifactOf(300, 300);
        const summary = await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target });
        assert.strictEqual(summary.files, 300);
        assert.ok(reader.peak > 100 && reader.peak <= 128, `${reader.peak} files at a time`);
        assert.strictEqual(fs.readFileSync(path.join(target, ...names[299].split('/').filter(Boolean)), 'utf8'), 'content of file 299');
    });

    it('honors a smaller number of files at a time', async () => {
        const { reader } = artifactOf(40, 10);
        await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 5 });
        assert.strictEqual(reader.peak, 5);
    });

    it('creates the folder that many files share once, although they all start together', async () => {
        const { reader } = artifactOf(200, 20);
        const original = fs.promises.mkdir;
        const created: string[] = [];
        fs.promises.mkdir = (async (...args: Parameters<typeof fs.promises.mkdir>) => {
            created.push(String(args[0]));
            return original.apply(fs.promises, args);
        }) as typeof fs.promises.mkdir;
        try {
            await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 100 });
        } finally {
            fs.promises.mkdir = original;
        }
        assert.strictEqual(created.filter(directory => directory.endsWith(`${path.sep}dir`)).length, 1);
        assert.strictEqual(fs.readdirSync(path.join(target, 'dir')).length, 200);
    });

    it('fails for a path that cannot be restored only when the patterns select it', async () => {
        const contents = new Map<string, Buffer>();
        const items = [{ path: '/good/file.txt', text: 'good' }, { path: '/bad/na\u0000me.txt', text: 'bad' }].map(entry => {
            const data = Buffer.from(entry.text);
            contents.set(chunkIdOf(data), data);
            return { path: entry.path, blob: { id: chunkIdOf(data), size: data.length } };
        });
        const reader = () => new CountingReader(buildManifest(items), contents, 0) as unknown as BlobReader;

        const summary = await downloadManifestArtifact({ reader: reader(), manifestId: 'manifest', targetDirectory: target, patterns: ['good/**'] });
        assert.strictEqual(summary.files, 1);
        assert.strictEqual(summary.skipped, 1);
        assert.strictEqual(fs.readFileSync(path.join(target, 'good', 'file.txt'), 'utf8'), 'good');

        await assert.rejects(() => downloadManifestArtifact({ reader: reader(), manifestId: 'manifest', targetDirectory: target, patterns: ['**'] }), /invalid character/);
        await assert.rejects(() => downloadManifestArtifact({ reader: reader(), manifestId: 'manifest', targetDirectory: target }), /invalid character/);
    });

    describe('chunks of one file', () => {
        const KiB = 1024;
        const leavesOf = (count: number, size: number): BlobRef[] => Array.from({ length: count }, (_, index) => ({ id: 'C'.repeat(62) + index.toString(16).padStart(2, '0') + '01', size }));

        it('requests the given number of chunks at a time for chunks of about a MiB, as before', () => {
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(1000, 1024 * KiB), 192), 32);
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(1000, 700 * KiB), 192), 47);
        });

        it('requests more chunks at a time when the chunks are small, up to what the reader lets through', () => {
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(10000, 77 * KiB), 192), 192);
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(10000, 77 * KiB), 100), 100);
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(10000, 512 * KiB), 192), 64);
        });

        it('never asks for fewer chunks than requested, nor for a reader that is not known', () => {
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(10000, 77 * KiB), 8), 32);
            assert.strictEqual(chunkConcurrencyFor(32, leavesOf(10000, 77 * KiB), 0), 32);
            assert.strictEqual(chunkConcurrencyFor(0, leavesOf(10000, 1024 * KiB), 0), 1);
        });

        it('does not ask for more chunks than the file has', () => {
            assert.strictEqual(chunkConcurrencyFor(8, leavesOf(5, 64 * KiB), 192), 5);
            assert.strictEqual(chunkConcurrencyFor(8, leavesOf(100, 64 * KiB), 192), 100);
            assert.strictEqual(chunkConcurrencyFor(8, [], 192), 1);
        });

        it('downloads a file of small chunks with far more requests at a time than a file of large chunks', async () => {
            const small = chunkedArtifact(1, 800, 150, () => undefined, 64 * KiB);
            (small.reader as unknown as { concurrency: number }).concurrency = 192;
            await downloadManifestArtifact({ reader: small.reader, manifestId: 'manifest', targetDirectory: target });
            assert.ok(small.state.peakFetching >= 180 && small.state.peakFetching <= 192, `${small.state.peakFetching} chunks of 64 KiB at a time`);
            assert.strictEqual(fs.statSync(path.join(target, 'dir', 'file-0.bin')).size, 800 * 64 * KiB);

            const large = chunkedArtifact(1, 80, 150, () => undefined, 1024 * KiB);
            (large.reader as unknown as { concurrency: number }).concurrency = 192;
            await downloadManifestArtifact({ reader: large.reader, manifestId: 'manifest', targetDirectory: path.join(target, 'large') });
            assert.strictEqual(large.state.peakFetching, 32, 'chunks of 1 MiB are requested 32 at a time, as before');
        });
    });

    describe('URLs resolved ahead', () => {
        interface AheadCall { ids: string[]; ahead: number }

        function aheadReader(count: number, behavior: { prefetch?: (ids: string[]) => Promise<void> } = {}) {
            const contents = new Map<string, Buffer>();
            const order = new Map<string, number>();
            const items = Array.from({ length: count }, (_, index) => {
                const data = Buffer.from(`file ${index}`);
                const id = chunkIdOf(data);
                contents.set(id, data);
                order.set(id, index);
                return { path: `/dir/file-${index}.txt`, blob: { id, size: data.length } };
            });
            const state = { calls: [] as AheadCall[], outstanding: 0, peakOutstanding: 0, fetched: 0, highest: -1 };
            const reader = {
                async readManifest() { return buildManifest(items); },
                async leaves(ref: BlobRef): Promise<BlobRef[]> { return [{ id: ref.id, size: ref.size }]; },
                async getBlob(id: string): Promise<Buffer> {
                    state.fetched++;
                    await new Promise(resolve => setTimeout(resolve, 1));
                    return contents.get(id)!;
                },
                async prefetchUrls(ids: string[]): Promise<void> {
                    state.calls.push({ ids: [...ids], ahead: 0 });
                    for (const id of ids) {
                        state.highest = Math.max(state.highest, order.get(id) ?? -1);
                    }
                    state.calls[state.calls.length - 1].ahead = state.highest - state.fetched;
                    state.peakOutstanding = Math.max(state.peakOutstanding, ++state.outstanding);
                    try {
                        await (behavior.prefetch ? behavior.prefetch(ids) : new Promise<void>(resolve => setTimeout(resolve, 3)));
                    } finally {
                        state.outstanding--;
                    }
                }
            };
            return { reader: reader as unknown as BlobReader, state, names: items.map(item => item.path) };
        }

        it('resolves the URLs of the files that follow, in a few large calls and not too far ahead', async () => {
            assert.strictEqual(URL_LOOKAHEAD_FILES, 16000);
            const { reader, state } = aheadReader(2000);
            const summary = await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, urlLookaheadFiles: 1200 });
            assert.strictEqual(summary.files, 2000);
            const requested = state.calls.flatMap(call => call.ids);
            assert.strictEqual(requested.length, 2000, 'every file has its URL requested once');
            assert.strictEqual(new Set(requested).size, 2000);
            assert.deepStrictEqual(state.calls.map(call => call.ids.length), [500, 500, 500, 500], 'calls of 500');
            assert.ok(state.peakOutstanding >= 1 && state.peakOutstanding <= 3, `${state.peakOutstanding} calls at a time`);
            const farthest = Math.max(...state.calls.map(call => call.ahead));
            assert.ok(farthest <= 1200 + 40, `${farthest} files ahead`);
            assert.ok(farthest >= 700, `the window should be used: ${farthest}`);
            assert.strictEqual(fs.readFileSync(path.join(target, 'dir', 'file-1999.txt'), 'utf8'), 'file 1999');
        });

        it('does not ask for the URL of an empty file or of a folder', async () => {
            const data = Buffer.from('content');
            const contents = new Map([[chunkIdOf(data), data]]);
            const items: ManifestItem[] = [
                { path: '/dir/full.txt', blob: { id: chunkIdOf(data), size: data.length } },
                { path: '/dir/empty.txt', blob: { id: EMPTY_CHUNK_ID, size: 0 } },
                { path: '/dir/nothing', type: EMPTY_DIRECTORY_TYPE }
            ];
            const asked: string[] = [];
            const reader = {
                async readManifest() { return buildManifest(items); },
                async leaves(ref: BlobRef): Promise<BlobRef[]> { return [{ id: ref.id, size: ref.size }]; },
                async getBlob(id: string): Promise<Buffer> { return id === EMPTY_CHUNK_ID ? Buffer.alloc(0) : contents.get(id)!; },
                async prefetchUrls(ids: string[]): Promise<void> { asked.push(...ids); }
            };
            const summary = await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target });
            assert.strictEqual(summary.files, 2);
            assert.deepStrictEqual(asked, [chunkIdOf(data)]);
            assert.strictEqual(fs.statSync(path.join(target, 'dir', 'empty.txt')).size, 0);
            assert.ok(fs.statSync(path.join(target, 'dir', 'nothing')).isDirectory());
        });

        it('downloads the files even when the URLs cannot be resolved ahead', async () => {
            const { reader, state } = aheadReader(500, { prefetch: async () => { throw new Error('the service is busy'); } });
            const summary = await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 20 });
            assert.strictEqual(summary.files, 500);
            assert.ok(state.calls.length >= 1);
            assert.strictEqual(fs.readFileSync(path.join(target, 'dir', 'file-499.txt'), 'utf8'), 'file 499');
        });

        it('goes on with its files while the calls that resolve the next URLs are stalled', async () => {
            let release!: () => void;
            const stalled = new Promise<void>(resolve => { release = resolve; });
            let first = true;
            const { reader, state } = aheadReader(600, {
                prefetch: async () => {
                    // The first call is answered at once; later ones wait, like calls that the service asks to repeat after 5 seconds.
                    if (first) { first = false; return; }
                    await stalled;
                }
            });
            try {
                const summary = await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 20 });
                assert.strictEqual(summary.files, 600);
                assert.strictEqual(state.fetched, 600);
                assert.ok(state.outstanding >= 1, 'a call is still waiting when the download is done');
            } finally {
                release();
            }
        });

        it('stops the lookahead when the download fails, so that its calls are dropped and a new attempt does not wait for them', async () => {
            const signals: AbortSignal[] = [];
            const { reader } = aheadReader(400, {
                prefetch: async () => undefined
            });
            const original = (reader as unknown as { prefetchUrls: (ids: string[], signal?: AbortSignal) => Promise<void> }).prefetchUrls;
            (reader as unknown as { prefetchUrls: unknown }).prefetchUrls = (ids: string[], signal?: AbortSignal) => {
                if (signal) { signals.push(signal); }
                return original.call(reader, ids, signal);
            };
            let fetches = 0;
            const failing = Object.create(reader) as BlobReader;
            (failing as unknown as { getBlob: unknown }).getBlob = async (id: string) => {
                if (++fetches === 50) {
                    throw new Error('the 50th blob failed');
                }
                return (reader as unknown as { getBlob: (id: string) => Promise<Buffer> }).getBlob(id);
            };
            await assert.rejects(() => downloadManifestArtifact({ reader: failing, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 10 }), /the 50th blob failed/);
            assert.ok(signals.length >= 1);
            assert.ok(signals.every(signal => signal.aborted), 'the calls were told to stop');
        });

        it('keeps the URLs of the chunks of a large file ahead of its downloads, in calls of at most 500', async () => {
            const chunks = 12000;
            const requested: string[][] = [];
            let outstanding = 0;
            let peak = 0;
            let fetched = 0;
            let farthest = 0;
            const ids = Array.from({ length: chunks }, (_, index) => 'B'.repeat(60) + index.toString(16).padStart(4, '0') + '01');
            const indexOf = new Map(ids.map((id, index) => [id, index]));
            const reader = {
                concurrency: 192,
                async readManifest() { return buildManifest([{ path: '/dir/big.bin', blob: { id: 'A'.repeat(64) + '02', size: chunks * 64 } }]); },
                async leaves(): Promise<BlobRef[]> { return ids.map(id => ({ id, size: 64 })); },
                async getBlob(_id: string, size: number): Promise<Buffer> {
                    fetched++;
                    await new Promise(resolve => setTimeout(resolve, 2));
                    return Buffer.alloc(size, 1);
                },
                async prefetchUrls(batch: string[]): Promise<void> {
                    requested.push([...batch]);
                    const chunkIndexes = batch.map(id => indexOf.get(id)).filter((index): index is number => index !== undefined);
                    if (chunkIndexes.length > 0) {
                        farthest = Math.max(farthest, Math.max(...chunkIndexes) - fetched);
                    }
                    peak = Math.max(peak, ++outstanding);
                    await new Promise(resolve => setTimeout(resolve, 3));
                    outstanding--;
                }
            };
            await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target, chunkConcurrency: 8 });
            const all = requested.flat();
            // The file itself (a node) is asked for through the lookahead of files, and its chunks through the lookahead of chunks.
            assert.strictEqual(all.filter(id => id.startsWith('A')).length, 1);
            const chunkIds = all.filter(id => id.startsWith('B'));
            assert.strictEqual(chunkIds.length, chunks);
            assert.strictEqual(new Set(chunkIds).size, chunks);
            assert.ok(requested.every(batch => batch.length <= 500));
            assert.ok(peak >= 1 && peak <= 4, `${peak} calls at a time`);
            assert.ok(farthest <= URL_LOOKAHEAD_CHUNKS_MAX + 500 + 192, `${farthest} chunks ahead`);
            assert.ok(farthest >= URL_LOOKAHEAD_CHUNKS_MAX / 2, `the window should be used: ${farthest}`);
            assert.strictEqual(fs.statSync(path.join(target, 'dir', 'big.bin')).size, chunks * 64);
        });

        it('keeps as many chunks ahead as hold some seconds of download, within limits', () => {
            const leavesOf = (count: number, size: number): BlobRef[] => Array.from({ length: count }, () => ({ id: 'D'.repeat(64) + '01', size }));
            // Chunks of 1.2 MiB: a few hundred are enough, but the least is kept.
            assert.strictEqual(chunkLookaheadWindow(leavesOf(5000, 1.2 * 1024 * 1024)), URL_LOOKAHEAD_CHUNKS_MIN);
            // Chunks of 77 KiB, as classic artifacts have them: about nine thousand.
            const small = chunkLookaheadWindow(leavesOf(14000, 77 * 1024));
            assert.ok(small > 8000 && small < URL_LOOKAHEAD_CHUNKS_MAX, `${small}`);
            // Tiny chunks do not make the window grow without limit.
            assert.strictEqual(chunkLookaheadWindow(leavesOf(100000, 64)), URL_LOOKAHEAD_CHUNKS_MAX);
        });

        it('does not keep the URLs of the chunks ahead for a file of few chunks, whose URLs are requested together', async () => {
            const asked: string[][] = [];
            const reader = {
                concurrency: 192,
                async readManifest() { return buildManifest([{ path: '/dir/small.bin', blob: { id: 'A'.repeat(64) + '02', size: 20 * 64 } }]); },
                async leaves(): Promise<BlobRef[]> { return Array.from({ length: 20 }, (_, index) => ({ id: 'B'.repeat(62) + index.toString(16).padStart(2, '0') + '01', size: 64 })); },
                async getBlob(_id: string, size: number): Promise<Buffer> { return Buffer.alloc(size, 1); },
                async prefetchUrls(batch: string[]): Promise<void> { asked.push(batch); }
            };
            await downloadManifestArtifact({ reader: reader as unknown as BlobReader, manifestId: 'manifest', targetDirectory: target });
            // The file itself is asked for once, through the lookahead of files, and its 20 chunks are not.
            assert.strictEqual(asked.length, 1);
            assert.strictEqual(asked[0].length, 1);
        });
    });

    describe('memory and failures', () => {
        const chunkBytes = 64;

        it('keeps the chunks that are downloaded and not yet written below a limit, however many files are in flight and however slow the disk is', async () => {
            const { reader, state } = chunkedArtifact(40, 16, 2);
            const originalOpen = fs.promises.open;
            fs.promises.open = (async (...args: Parameters<typeof fs.promises.open>) => {
                const handle = await originalOpen.apply(fs.promises, args);
                const write = handle.write.bind(handle) as (...parameters: unknown[]) => Promise<unknown>;
                (handle as unknown as { write: unknown }).write = async (...parameters: unknown[]) => {
                    await new Promise(resolve => setTimeout(resolve, 5));
                    const result = await write(...parameters);
                    state.held--;
                    return result;
                };
                return handle;
            }) as typeof fs.promises.open;
            try {
                const summary = await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, chunkConcurrency: 16, maxBufferedChunks: 12 });
                assert.strictEqual(summary.files, 40);
            } finally {
                fs.promises.open = originalOpen;
            }
            assert.ok(state.peakHeld <= 12, `${state.peakHeld} chunks were held`);
            assert.ok(state.peakFetching <= 12, `${state.peakFetching} chunks were fetched at a time`);
            assert.ok(state.peakFetching >= 8, `the limit should be used: ${state.peakFetching}`);
            assert.strictEqual(fs.statSync(path.join(target, 'dir', 'file-39.bin')).size, 16 * chunkBytes);
        });

        it('allows 256 chunks by default and as many as the reader may request plus 64 for a reader with more parallelism', async () => {
            assert.strictEqual(DEFAULT_MAX_BUFFERED_CHUNKS, 256);
            const { reader, state } = chunkedArtifact(40, 16, 150);
            await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, chunkConcurrency: 16 });
            assert.ok(state.peakFetching > 200 && state.peakFetching <= DEFAULT_MAX_BUFFERED_CHUNKS, `${state.peakFetching} chunks were fetched at a time`);

            const parallel = chunkedArtifact(40, 16, 150);
            (parallel.reader as unknown as { concurrency: number }).concurrency = 400;
            await downloadManifestArtifact({ reader: parallel.reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, chunkConcurrency: 16 });
            assert.ok(parallel.state.peakFetching > 400 && parallel.state.peakFetching <= 464, `${parallel.state.peakFetching} chunks were fetched at a time`);
        });

        it('counts a chunk for every MiB it holds, so that large chunks cannot fill the memory', async () => {
            const { reader, state } = chunkedArtifact(6, 4, 15, () => undefined, 3 * 1024 * 1024);
            // A chunk of 3 MiB takes 3 of the 7 units, so two chunks are downloaded at a time.
            await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 6, chunkConcurrency: 8, maxBufferedChunks: 7 });
            assert.strictEqual(state.peakFetching, 2);
            assert.strictEqual(fs.statSync(path.join(target, 'dir', 'file-5.bin')).size, 4 * 3 * 1024 * 1024);
        });

        it('stops downloading as soon as one file fails, reports that failure and leaves no temporary files', async () => {
            const { reader, state } = chunkedArtifact(30, 8, 20, async call => {
                if (call === 3) {
                    await new Promise(resolve => setTimeout(resolve, 5));
                    throw new Error('boom: the third chunk failed');
                }
            });
            await assert.rejects(
                () => downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 30, chunkConcurrency: 8, maxBufferedChunks: 4 }),
                /boom: the third chunk failed/);
            assert.ok(state.calls < 30, `${state.calls} chunks were requested although 240 were available`);
            const leftovers = fs.existsSync(path.join(target, 'dir')) ? fs.readdirSync(path.join(target, 'dir')).filter(name => name.endsWith('.tmp')) : [];
            assert.deepStrictEqual(leftovers, []);
        });

        it('stops when the caller aborts', async () => {
            const controller = new AbortController();
            const { reader, state } = chunkedArtifact(30, 8, 20, call => { if (call === 5) { controller.abort(); } });
            await assert.rejects(
                () => downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 30, chunkConcurrency: 8, maxBufferedChunks: 4, signal: controller.signal }),
                (error: Error) => error.name === 'AbortedError');
            assert.ok(state.calls < 30, `${state.calls} chunks were requested although 240 were available`);
        });
    });
});
