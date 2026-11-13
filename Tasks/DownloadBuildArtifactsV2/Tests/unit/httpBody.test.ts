import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { HttpClient, isTransientError } from '../../DownloadEngine/http/httpClient';

describe('HttpClient response bodies', function () {
    this.timeout(30000);

    let server: http.Server;
    let port: number;
    let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    const client = new HttpClient({ allowInsecureLoopback: true });

    beforeEach(async () => {
        server = http.createServer((req, res) => handler(req, res));
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as AddressInfo).port;
    });

    afterEach(async () => {
        server.closeAllConnections?.();
        await new Promise<void>(resolve => server.close(() => resolve()));
    });

    after(() => client.close());

    const url = () => `http://127.0.0.1:${port}/`;

    function pattern(size: number): Buffer {
        const data = Buffer.alloc(size);
        for (let index = 0; index < size; index++) {
            data[index] = (index * 31 + (index >> 8)) & 0xff;
        }
        return data;
    }

    it('receives a body of a known size into one buffer that owns its memory, so that it can move to a worker thread', async () => {
        const data = pattern(3 * 1024 * 1024 + 5);
        handler = (_req, res) => {
            res.setHeader('Content-Length', data.length);
            for (let offset = 0; offset < data.length; offset += 40000) {
                res.write(data.subarray(offset, Math.min(data.length, offset + 40000)));
            }
            res.end();
        };
        const response = await client.request(url());
        assert.ok(response.body.equals(data));
        assert.strictEqual(response.body.byteOffset, 0);
        assert.strictEqual(response.body.buffer.byteLength, data.length);
    });

    it('receives a body of an unknown size and an empty body', async () => {
        const data = pattern(200000);
        handler = (_req, res) => {
            res.write(data.subarray(0, 100000));
            res.end(data.subarray(100000));
        };
        assert.ok((await client.request(url())).body.equals(data));

        handler = (_req, res) => {
            res.setHeader('Content-Length', '0');
            res.end();
        };
        assert.strictEqual((await client.request(url())).body.length, 0);
    });

    it('does not wait for a body after a HEAD request that advertises a length', async () => {
        handler = (_req, res) => {
            res.setHeader('Content-Length', '12345');
            res.end();
        };
        const response = await client.request(url(), { method: 'HEAD' });
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.length, 0);
    });

    it('fails with a transient error when the connection ends before the advertised length', async () => {
        handler = (_req, res) => {
            res.setHeader('Content-Length', '100000');
            res.write(pattern(1000));
            setTimeout(() => res.socket?.destroy(), 20);
        };
        await assert.rejects(() => client.request(url()), (error: Error) => isTransientError(error));
    });

    it('rejects a body above the limit, also when it is only advertised', async () => {
        let sent = 0;
        handler = (_req, res) => {
            res.setHeader('Content-Length', '1000');
            res.write(pattern(100));
            sent = 100;
            setTimeout(() => res.end(pattern(900)), 200);
        };
        await assert.rejects(() => client.request(url(), { maxResponseBytes: 500 }), /exceeds the supported size of 500 bytes/);
        assert.strictEqual(sent, 100);

        handler = (_req, res) => {
            res.write(pattern(400));
            res.end(pattern(400));
        };
        await assert.rejects(() => client.request(url(), { maxResponseBytes: 500 }), /exceeds the supported size of 500 bytes/);
    });
});
