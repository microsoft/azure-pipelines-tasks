import * as assert from 'assert';
import { IntegrityError } from '../../DownloadEngine/errors';
import { DedupTransport, discoverBlobStore } from '../../DownloadEngine/dedup/blobStore';
import { BlobReader } from '../../DownloadEngine/dedup/blobReader';
import { BlobRef, EMPTY_CHUNK_ID, chunkIdOf, nodeIdOf } from '../../DownloadEngine/dedup/hashing';
import { MAX_MANIFEST_BYTES } from '../../DownloadEngine/dedup/manifest';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { telemetry } from '../../DownloadEngine/util/telemetry';
import { FakeService } from './fakeService';

describe('BlobReader', () => {
    let service: FakeService;
    let http: HttpClient;
    let reader: BlobReader;

    beforeEach(async () => {
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => 'Bearer test', allowInsecureLoopback: true });
        const location = await discoverBlobStore(http, service.baseUrl + '/');
        reader = new BlobReader({ transport: new DedupTransport({ http, location }), http, concurrency: 4 });
    });

    afterEach(async () => {
        http.close();
        await service.stop();
    });

    it('returns the empty chunk only for a size of zero', async () => {
        assert.strictEqual((await reader.getBlob(EMPTY_CHUNK_ID, 0)).length, 0);
        assert.strictEqual((await reader.getBlob(EMPTY_CHUNK_ID, undefined)).length, 0);
        await assert.rejects(() => reader.getBlob(EMPTY_CHUNK_ID, 5), IntegrityError);
    });

    it('resolves the URLs of many blobs in calls of up to 500 identifiers, and reads the blobs without asking again', async () => {
        const blobs = Array.from({ length: 1200 }, (_, index) => {
            const data = Buffer.from(`blob number ${index}`);
            const id = chunkIdOf(data);
            service.chunks.set(id, data);
            return { id, data };
        });
        const urlCalls = () => service.requests
            .filter(request => request.method === 'POST' && request.path.endsWith('/_apis/dedup/urls'))
            .map(request => (JSON.parse(request.body.toString('utf8')) as string[]).length);

        await reader.prefetchUrls(blobs.map(blob => blob.id));
        assert.deepStrictEqual(urlCalls().sort((a, b) => b - a), [500, 500, 200]);

        for (const blob of blobs.slice(0, 100)) {
            assert.deepStrictEqual(await reader.getBlob(blob.id, blob.data.length), blob.data);
        }
        assert.strictEqual(urlCalls().length, 3, 'the blobs were read with the URLs that were resolved ahead');
    });

    it('lets a read that comes while its URL is being resolved ahead wait for that call instead of making its own', async () => {
        const data = Buffer.from('a blob that is wanted at once');
        const id = chunkIdOf(data);
        service.chunks.set(id, data);
        const others = Array.from({ length: 30 }, (_, index) => {
            const other = Buffer.from(`other blob ${index}`);
            service.chunks.set(chunkIdOf(other), other);
            return chunkIdOf(other);
        });
        const ahead = reader.prefetchUrls([id, ...others]);
        assert.deepStrictEqual(await reader.getBlob(id, data.length), data);
        await ahead;
        const urlCalls = service.requests.filter(request => request.method === 'POST' && request.path.endsWith('/_apis/dedup/urls'));
        assert.strictEqual(urlCalls.length, 1);
    });

    it('fails a prefetch when the service does not know a blob, and a later read asks for it again', async () => {
        const known = Buffer.from('known');
        service.chunks.set(chunkIdOf(known), known);
        const unknown = chunkIdOf(Buffer.from('unknown'));
        await assert.rejects(() => reader.prefetchUrls([chunkIdOf(known), unknown]), /did not return a URL/);
        assert.deepStrictEqual(await reader.getBlob(chunkIdOf(known), known.length), known);
    });

    describe('when the calls that resolve URLs ahead are dropped', () => {
        function heldTransport(): { transport: DedupTransport; calls: string[][]; release: () => void } {
            const calls: string[][] = [];
            let release!: () => void;
            const held = new Promise<void>(resolve => { release = resolve; });
            const transport = {
                async resolveUrls(ids: readonly string[]): Promise<Record<string, string>> {
                    calls.push([...ids]);
                    // The first calls wait, like calls that the service has asked to repeat.
                    if (calls.length <= 3) {
                        await held;
                    }
                    return Object.fromEntries(ids.map(id => [id, `${service.baseUrl}/storage/${id}`]));
                }
            } as unknown as DedupTransport;
            return { transport, calls, release };
        }

        function manyBlobs(count: number): Array<{ id: string; data: Buffer }> {
            return Array.from({ length: count }, (_, index) => {
                const data = Buffer.from(`dropped blob ${index}`);
                const id = chunkIdOf(data);
                service.chunks.set(id, data);
                return { id, data };
            });
        }

        it('does not send the calls that have not been sent when the lookahead stops, and a later read asks for its URL again', async () => {
            const { transport, calls, release } = heldTransport();
            const dropping = new BlobReader({ transport, http, concurrency: 4 });
            const blobs = manyBlobs(2000);
            const controller = new AbortController();
            const prefetch = dropping.prefetchUrls(blobs.map(blob => blob.id), controller.signal);
            const outcome = prefetch.then(() => 'resolved', error => (error as Error).name);

            // Three calls of 500 are on their way, the fourth waits for one of them.
            await new Promise(resolve => setTimeout(resolve, 50));
            assert.strictEqual(calls.length, 3);
            controller.abort();
            release();
            assert.strictEqual(await outcome, 'UrlRequestDroppedError');
            assert.strictEqual(calls.length, 3, 'the call that was waiting was not sent');

            const last = blobs[1999];
            assert.deepStrictEqual(await dropping.getBlob(last.id, last.data.length), last.data);
            assert.strictEqual(calls.length, 4, 'the read asked for its URL itself');
        });

        it('lets a read that waited for a dropped call ask again, instead of failing', async () => {
            const { transport, calls, release } = heldTransport();
            const dropping = new BlobReader({ transport, http, concurrency: 4 });
            const blobs = manyBlobs(2000);
            const controller = new AbortController();
            void dropping.prefetchUrls(blobs.map(blob => blob.id), controller.signal).catch(() => undefined);
            await new Promise(resolve => setTimeout(resolve, 50));

            const last = blobs[1999];
            const read = dropping.getBlob(last.id, last.data.length);
            controller.abort();
            release();
            assert.deepStrictEqual(await read, last.data);
            assert.strictEqual(calls.length, 4);
        });

        it('drops a call that waits for its turn as soon as the lookahead stops, while the calls that were sent are still held', async () => {
            const { transport, calls, release } = heldTransport();
            const dropping = new BlobReader({ transport, http, concurrency: 4 });
            const blobs = manyBlobs(2000);
            const controller = new AbortController();
            const outcome = dropping.prefetchUrls(blobs.map(blob => blob.id), controller.signal).then(() => 'resolved', error => (error as Error).name);
            await new Promise(resolve => setTimeout(resolve, 50));
            assert.strictEqual(calls.length, 3);

            controller.abort();
            assert.strictEqual(await outcome, 'UrlRequestDroppedError');

            // Nothing is left pending for the blobs of the dropped call, so a read, or a new prefetch, asks at once.
            const last = blobs[1999];
            assert.deepStrictEqual(await dropping.getBlob(last.id, last.data.length), last.data);
            assert.strictEqual(calls.length, 4, 'the read did not wait for the calls that are held');
            release();
        });

        it('sends nothing for a signal that is already aborted', async () => {
            const { transport, calls } = heldTransport();
            const dropping = new BlobReader({ transport, http, concurrency: 4 });
            const blobs = manyBlobs(10);
            const controller = new AbortController();
            controller.abort();
            await assert.rejects(() => dropping.prefetchUrls(blobs.map(blob => blob.id), controller.signal), /dropped before it was sent/);
            assert.strictEqual(calls.length, 0);
        });
    });

    it('verifies the identifier and the advertised size of downloaded chunks', async () => {
        telemetry.reset();
        const data = Buffer.from('some chunk content');
        const id = chunkIdOf(data);
        service.chunks.set(id, data);
        assert.deepStrictEqual(await reader.getBlob(id, data.length), data);
        await assert.rejects(() => reader.getBlob(id, data.length + 1), IntegrityError);

        const wrong = chunkIdOf(Buffer.from('other'));
        service.chunks.set(wrong, data);
        await assert.rejects(() => reader.getBlob(wrong, undefined), IntegrityError);

        // Each chunk that failed the check was downloaded again and counted as an integrity retry.
        const counted = telemetry.snapshot();
        assert.ok(counted.integrityRetries > 0, 'the damaged chunks were counted');
        assert.strictEqual(counted.integrityRetries, counted.blobRetries);
    });

    it('reads manifests of up to 256 MiB by default', async () => {
        class ProbeReader extends BlobReader {
            limit: number | undefined;

            async getNodeChildren(): Promise<BlobRef[]> {
                return [{ id: chunkIdOf(Buffer.from('chunk')), size: 100 * 1024 * 1024 }];
            }

            async readAll(_ref: BlobRef, limit: number): Promise<Buffer> {
                this.limit = limit;
                return Buffer.alloc(0);
            }
        }

        const location = await discoverBlobStore(http, service.baseUrl + '/');
        const probe = new ProbeReader({ transport: new DedupTransport({ http, location }), http, concurrency: 4 });
        await probe.readManifest(nodeIdOf(Buffer.from('node')));
        assert.strictEqual(probe.limit, MAX_MANIFEST_BYTES);
        assert.strictEqual(MAX_MANIFEST_BYTES, 256 * 1024 * 1024);
    });
});
