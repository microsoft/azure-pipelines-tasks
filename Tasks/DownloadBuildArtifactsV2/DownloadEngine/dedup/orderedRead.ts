import { Semaphore } from '../util/concurrency';
import { BlobReader } from './blobReader';
import { budgetFor } from './download';
import { BlobRef, MAX_CHUNK_BYTES } from './hashing';

/**
 * Reads the chunks of a blob in order, downloading some of the following chunks ahead so that the connection stays busy while an
 * in-order consumer (a decompressor) works. Chunks that are downloaded and not yet handed on count against `budget`, like the chunks
 * written to files.
 *
 * A reader always reads its first chunk so that every reader progresses, starts the others only while the budget has room, and never
 * waits for the budget while it holds a chunk that the consumer has not received, so readers cannot wait for each other.
 */
export async function* readChunksInOrder(reader: BlobReader, leaves: readonly BlobRef[], budget: Semaphore, ahead: number): AsyncGenerator<Buffer> {
    interface Started {
        download: Promise<Buffer>;
        release: () => void;
    }

    const started: Started[] = [];
    let next = 0;
    try {
        while (next < leaves.length || started.length > 0) {
            while (next < leaves.length && started.length < ahead) {
                const leaf = leaves[next];
                const release = started.length === 0
                    ? await budget.acquire(budgetFor(leaf.size))
                    : budget.tryAcquire(budgetFor(leaf.size));
                if (!release) {
                    break;
                }
                next++;
                const download = reader.getBlob(leaf.id, leaf.size, MAX_CHUNK_BYTES);
                // A chunk that is never awaited because an earlier one failed must not raise an unhandled rejection.
                download.catch(() => undefined);
                started.push({ download, release });
            }

            const head = started.shift()!;
            try {
                yield await head.download;
            } finally {
                head.release();
            }
        }
    } finally {
        // The consumer stopped early or a chunk failed: the reads that are still running give back their share when they end.
        for (const entry of started) {
            entry.download.then(entry.release, entry.release);
        }
    }
}
