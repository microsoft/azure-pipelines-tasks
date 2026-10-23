import * as assert from 'assert';
import { IntegrityError } from '../src/errors';
import { DedupTransport, discoverBlobStore } from '../src/dedup/blobStore';
import { BlobReader } from '../src/dedup/blobReader';
import { BlobRef, EMPTY_CHUNK_ID, chunkIdOf, nodeIdOf } from '../src/dedup/hashing';
import { MAX_MANIFEST_BYTES } from '../src/dedup/manifest';
import { HttpClient } from '../src/http/httpClient';
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

    it('verifies the identifier and the advertised size of downloaded chunks', async () => {
        const data = Buffer.from('some chunk content');
        const id = chunkIdOf(data);
        service.chunks.set(id, data);
        assert.deepStrictEqual(await reader.getBlob(id, data.length), data);
        await assert.rejects(() => reader.getBlob(id, data.length + 1), IntegrityError);

        const wrong = chunkIdOf(Buffer.from('other'));
        service.chunks.set(wrong, data);
        await assert.rejects(() => reader.getBlob(wrong, undefined), IntegrityError);
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
