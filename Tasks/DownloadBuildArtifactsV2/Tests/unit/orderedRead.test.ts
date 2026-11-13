import * as assert from 'assert';
import { BlobReader } from '../../DownloadEngine/dedup/blobReader';
import { readChunksInOrder } from '../../DownloadEngine/dedup/orderedRead';
import { BlobRef } from '../../DownloadEngine/dedup/hashing';
import { Semaphore } from '../../DownloadEngine/util/concurrency';

const MiB = 1024 * 1024;

interface FakeReaderState {
    started: number;
    consumed: number;
    /** The most chunks that were started and not yet received by the consumer. */
    peakUnconsumed: number;
}

function fakeReader(delays: (index: number) => number, failAt?: number): { reader: BlobReader; leaves: BlobRef[]; state: FakeReaderState } {
    const state: FakeReaderState = { started: 0, consumed: 0, peakUnconsumed: 0 };
    const leaves: BlobRef[] = Array.from({ length: 60 }, (_, index) => ({ id: index.toString(16).padStart(64, '0') + '01', size: 4 }));
    const reader = {
        concurrency: 192,
        async getBlob(id: string): Promise<Buffer> {
            const index = leaves.findIndex(leaf => leaf.id === id);
            state.started++;
            state.peakUnconsumed = Math.max(state.peakUnconsumed, state.started - state.consumed);
            await new Promise(resolve => setTimeout(resolve, delays(index)));
            if (index === failAt) {
                throw new Error(`chunk ${index} failed`);
            }
            return Buffer.from([index, index, index, index]);
        }
    };
    return { reader: reader as unknown as BlobReader, leaves, state };
}

async function drain(source: AsyncGenerator<Buffer>, state: FakeReaderState | undefined, perChunkMs = 0): Promise<Buffer[]> {
    const chunks: Buffer[] = [];
    for await (const chunk of source) {
        if (state) {
            state.consumed++;
        }
        chunks.push(chunk);
        if (perChunkMs) {
            await new Promise(resolve => setTimeout(resolve, perChunkMs));
        }
    }
    return chunks;
}

describe('reading chunks in order with some downloaded ahead', function () {
    this.timeout(30000);

    it('hands the chunks on in order although they arrive in another order', async () => {
        const { reader, leaves, state } = fakeReader(index => (index % 7) * 6);
        const chunks = await drain(readChunksInOrder(reader, leaves, new Semaphore(64), 16), state);
        assert.deepStrictEqual(chunks.map(chunk => chunk[0]), leaves.map((_, index) => index));
    });

    it('starts chunks ahead, but not more than asked for', async () => {
        const { reader, leaves, state } = fakeReader(() => 20);
        await drain(readChunksInOrder(reader, leaves, new Semaphore(64), 8), state);
        assert.ok(state.peakUnconsumed > 3, `${state.peakUnconsumed} chunks ahead`);
        assert.ok(state.peakUnconsumed <= 8, `${state.peakUnconsumed} chunks ahead`);
    });

    it('holds no more chunks than the budget has room for, and still reads everything', async () => {
        const { reader, leaves, state } = fakeReader(index => (index % 5) * 3 + 1);
        const chunks = await drain(readChunksInOrder(reader, leaves, new Semaphore(3), 32), state, 2);
        assert.strictEqual(chunks.length, 60);
        assert.ok(state.peakUnconsumed <= 3, `${state.peakUnconsumed} chunks held with a budget of 3`);
    });

    it('counts large chunks by their size, so that fewer of them are held', async () => {
        const leaves: BlobRef[] = Array.from({ length: 12 }, (_, index) => ({ id: index.toString(16).padStart(64, '0') + '01', size: 3 * MiB }));
        const counts = { started: 0, consumed: 0, peak: 0 };
        const reader = {
            concurrency: 192,
            async getBlob(): Promise<Buffer> {
                counts.peak = Math.max(counts.peak, ++counts.started - counts.consumed);
                await new Promise(resolve => setTimeout(resolve, 10));
                return Buffer.alloc(8);
            }
        } as unknown as BlobReader;
        // A chunk of 3 MiB takes 3 units, so a budget of 7 units holds two at a time.
        for await (const chunk of readChunksInOrder(reader, leaves, new Semaphore(7), 32)) {
            assert.strictEqual(chunk.length, 8);
            counts.consumed++;
            await new Promise(resolve => setTimeout(resolve, 12));
        }
        assert.strictEqual(counts.started, 12);
        assert.ok(counts.peak <= 2, `${counts.peak} large chunks held`);
    });

    it('lets many readers share a small budget without waiting for each other', async () => {
        const budget = new Semaphore(4);
        const readers = Array.from({ length: 12 }, () => {
            const { reader, leaves, state } = fakeReader(index => (index % 4) * 4 + 1);
            return drain(readChunksInOrder(reader, leaves, budget, 16), state, 1);
        });
        const results = await Promise.all(readers);
        assert.ok(results.every(chunks => chunks.length === 60));
    });

    it('gives the budget back when the consumer stops early', async () => {
        const { reader, leaves, state } = fakeReader(() => 15);
        const budget = new Semaphore(10);
        const source = readChunksInOrder(reader, leaves, budget, 8);
        for (let taken = 0; taken < 3; taken++) {
            await source.next();
        }
        await source.return(undefined);
        // The reads that were already started give their share back when they end.
        await new Promise(resolve => setTimeout(resolve, 100));
        const everything = budget.tryAcquire(10);
        assert.ok(everything, 'the whole budget is free again');
        everything?.();
        assert.ok(state.started < 60, `${state.started} of 60 chunks were started`);
    });

    it('gives the budget back and reports the failure when a chunk fails', async () => {
        const { reader, leaves, state } = fakeReader(index => (index === 5 ? 30 : 5), 5);
        const budget = new Semaphore(10);
        await assert.rejects(() => drain(readChunksInOrder(reader, leaves, budget, 8), state), /chunk 5 failed/);
        await new Promise(resolve => setTimeout(resolve, 100));
        const everything = budget.tryAcquire(10);
        assert.ok(everything, 'the whole budget is free again');
        everything?.();
    });
});
