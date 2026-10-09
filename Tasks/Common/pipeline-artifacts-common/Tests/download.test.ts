import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BlobReader } from '../src/dedup/blobReader';
import { DEFAULT_FILE_CONCURRENCY, DEFAULT_MAX_BUFFERED_CHUNKS, downloadManifestArtifact } from '../src/dedup/download';
import { BlobRef, chunkIdOf } from '../src/dedup/hashing';
import { buildManifest } from '../src/dedup/manifest';

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
        target = fs.mkdtempSync(path.join(os.tmpdir(), 'pac-download-'));
    });

    afterEach(() => {
        fs.rmSync(target, { recursive: true, force: true });
    });

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

    describe('memory and failures', () => {
        const chunkBytes = 64;

        function chunkedArtifact(files: number, leavesPerFile: number, fetchMs: number, onFetch: (call: number) => Promise<void> | void = () => undefined) {
            const items = Array.from({ length: files }, (_, index) => ({
                path: `/dir/file-${index}.bin`,
                blob: { id: 'A'.repeat(64) + '02', size: leavesPerFile * chunkBytes }
            }));
            const state = { calls: 0, fetching: 0, peakFetching: 0, held: 0, peakHeld: 0 };
            const reader = {
                async readManifest() { return buildManifest(items); },
                async leaves(): Promise<BlobRef[]> {
                    return Array.from({ length: leavesPerFile }, (_, index) => ({ id: 'B'.repeat(62) + index.toString(16).padStart(2, '0') + '01', size: chunkBytes }));
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
            const { reader, state } = chunkedArtifact(40, 16, 20);
            await downloadManifestArtifact({ reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, chunkConcurrency: 16 });
            assert.ok(state.peakFetching > 200 && state.peakFetching <= DEFAULT_MAX_BUFFERED_CHUNKS, `${state.peakFetching} chunks were fetched at a time`);

            const parallel = chunkedArtifact(40, 16, 20);
            (parallel.reader as unknown as { concurrency: number }).concurrency = 400;
            await downloadManifestArtifact({ reader: parallel.reader, manifestId: 'manifest', targetDirectory: target, fileConcurrency: 40, chunkConcurrency: 16 });
            assert.ok(parallel.state.peakFetching > 400 && parallel.state.peakFetching <= 464, `${parallel.state.peakFetching} chunks were fetched at a time`);
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
