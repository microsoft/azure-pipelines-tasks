import * as assert from 'assert';
import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as zlib from 'zlib';
import { AbortedError, HttpError } from '../src/errors';
import { DEFAULT_DEADLINE_MS, HttpClient, contentDecoder, isTransientError } from '../src/http/httpClient';

describe('HttpClient', () => {
    let server: http.Server;
    let port: number;
    let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
    const seen: http.IncomingHttpHeaders[] = [];

    beforeEach(async () => {
        seen.length = 0;
        server = http.createServer((req, res) => {
            seen.push(req.headers);
            handler(req, res);
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as AddressInfo).port;
    });

    afterEach(async () => {
        server.closeAllConnections?.();
        await new Promise<void>(resolve => server.close(() => resolve()));
    });

    const client = (options: ConstructorParameters<typeof HttpClient>[0] = {}) =>
        new HttpClient({ allowInsecureLoopback: true, authorization: () => 'Bearer secret', ...options });

    it('refuses plain http unless loopback testing is enabled and decodes compressed bodies', async () => {
        handler = (_req, res) => {
            res.setHeader('Content-Encoding', 'gzip');
            res.end(zlib.gzipSync(Buffer.from('{"hello":"world"}')));
        };
        await assert.rejects(() => new HttpClient().request(`http://127.0.0.1:${port}/`), /Only HTTPS/);
        const json = await client().json<{ hello: string }>(`http://127.0.0.1:${port}/`);
        assert.strictEqual(json.hello, 'world');
        assert.strictEqual(seen[0]['accept-encoding'], 'gzip, deflate');
    });

    it('retries transient failures and reports the final failure with the request id', async () => {
        let calls = 0;
        handler = (_req, res) => {
            calls++;
            if (calls < 3) {
                res.statusCode = 503;
                res.setHeader('Retry-After', '0');
                res.end('busy');
            } else {
                res.end('ok');
            }
        };
        const response = await client().request(`http://127.0.0.1:${port}/x`, { retries: 3 });
        assert.strictEqual(response.body.toString(), 'ok');
        assert.strictEqual(calls, 3);

        calls = 0;
        handler = (_req, res) => {
            calls++;
            res.statusCode = 404;
            res.setHeader('X-VSS-E2EID', 'abc-123');
            res.end('{"message":"nope"}');
        };
        await assert.rejects(() => client().request(`http://127.0.0.1:${port}/missing`, { retries: 3 }), (error: HttpError) => {
            return error instanceof HttpError && error.status === 404 && error.requestId === 'abc-123' && /nope/.test(error.message);
        });
        assert.strictEqual(calls, 1, 'client errors are not retried');
    });

    it('can return selected error statuses to the caller', async () => {
        handler = (_req, res) => { res.statusCode = 409; res.end('conflict'); };
        const response = await client().request(`http://127.0.0.1:${port}/`, { acceptStatuses: [409] });
        assert.strictEqual(response.status, 409);
        assert.strictEqual(response.body.toString(), 'conflict');
    });

    it('sends the authorization header only to trusted hosts and only when asked to', async () => {
        handler = (_req, res) => res.end('ok');
        await client({ trustedHosts: ['127.0.0.1'] }).request(`http://127.0.0.1:${port}/`);
        await client({ trustedHosts: ['example.org'] }).request(`http://127.0.0.1:${port}/`);
        await client({ trustedHosts: ['127.0.0.1'] }).request(`http://127.0.0.1:${port}/`, { authenticated: false });
        assert.strictEqual(seen[0]['authorization'], 'Bearer secret');
        assert.strictEqual(seen[1]['authorization'], undefined);
        assert.strictEqual(seen[2]['authorization'], undefined);
    });

    it('drops the authorization header when a redirect leaves the host', async () => {
        handler = (req, res) => {
            if (req.url === '/start') {
                res.statusCode = 302;
                res.setHeader('Location', `http://localhost:${port}/final`);
                res.end();
            } else {
                res.end('arrived');
            }
        };
        const response = await client().request(`http://127.0.0.1:${port}/start`);
        assert.strictEqual(response.body.toString(), 'arrived');
        assert.strictEqual(seen[0]['authorization'], 'Bearer secret');
        assert.strictEqual(seen[1]['authorization'], undefined);

        handler = (req, res) => {
            res.statusCode = 302;
            res.setHeader('Location', `http://127.0.0.1:${port}${req.url}`);
            res.end();
        };
        await assert.rejects(() => client().request(`http://127.0.0.1:${port}/loop`, { maxRedirects: 2 }), /Too many redirects/);
    });

    it('stops reading responses that are larger than allowed and honors abort signals and timeouts', async () => {
        handler = (_req, res) => res.end(Buffer.alloc(100000));
        await assert.rejects(() => client().request(`http://127.0.0.1:${port}/`, { maxResponseBytes: 1000 }), /exceeds the supported size/);

        handler = () => { /* never answers */ };
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 50);
        await assert.rejects(() => client().request(`http://127.0.0.1:${port}/`, { signal: controller.signal }), AbortedError);
        await assert.rejects(() => client({ timeoutMs: 100 }).request(`http://127.0.0.1:${port}/`), (error: NodeJS.ErrnoException) => error.code === 'ETIMEDOUT');
    });

    it('classifies transient errors', () => {
        assert.ok(isTransientError(new HttpError('x', 503)));
        assert.ok(isTransientError(Object.assign(new Error('x'), { code: 'ECONNRESET' })));
        assert.ok(!isTransientError(new HttpError('x', 404)));
        assert.ok(!isTransientError(new AbortedError()));
    });

    it('ends a request that keeps trickling data after its deadline, although the connection is never idle', async () => {
        handler = (_req, res) => {
            res.write('x');
            const timer = setInterval(() => res.write('x'), 20);
            res.on('close', () => clearInterval(timer));
        };
        const started = Date.now();
        await assert.rejects(
            () => client({ timeoutMs: 60000 }).request(`http://127.0.0.1:${port}/`, { deadlineMs: 300 }),
            (error: NodeJS.ErrnoException) => error.code === 'ETIMEDOUT' && /time limit/.test(error.message));
        assert.ok(Date.now() - started < 10000);
    });

    it('applies a deadline to a stream until it has ended, and to the wait for the response', async () => {
        handler = (_req, res) => {
            res.write('x');
            const timer = setInterval(() => res.write('x'), 20);
            res.on('close', () => clearInterval(timer));
        };
        await assert.rejects(async () => {
            const response = await client().requestStream(`http://127.0.0.1:${port}/`, { deadlineMs: 300 });
            for await (const chunk of response.stream) {
                void chunk;
            }
        }, (error: NodeJS.ErrnoException) => error.code === 'ETIMEDOUT' && /time limit/.test(error.message));

        handler = () => { /* never answers */ };
        await assert.rejects(
            () => client({ timeoutMs: 60000 }).requestStream(`http://127.0.0.1:${port}/`, { deadlineMs: 200 }),
            (error: NodeJS.ErrnoException) => error.code === 'ETIMEDOUT' && /time limit/.test(error.message));
    });

    it('does not end a request that finishes within its deadline, and gives buffered requests half an hour by default', async () => {
        handler = (_req, res) => setTimeout(() => res.end('done'), 50);
        const response = await client().request(`http://127.0.0.1:${port}/`, { deadlineMs: 5000 });
        assert.strictEqual(response.body.toString(), 'done');
        assert.strictEqual(DEFAULT_DEADLINE_MS, 30 * 60 * 1000);
    });

    it('decodes the content encodings that the services use', async () => {
        const text = Buffer.from('hello encoded world'.repeat(50));
        const encoded: Record<string, Buffer> = {
            gzip: zlib.gzipSync(text),
            'x-gzip': zlib.gzipSync(text),
            deflate: zlib.deflateSync(text),
            br: zlib.brotliCompressSync(text),
            ' GZip ': zlib.gzipSync(text)
        };
        for (const [name, body] of Object.entries(encoded)) {
            const decoder = contentDecoder(name);
            assert.ok(decoder, name);
            const parts: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
                decoder!.on('data', (part: Buffer) => parts.push(part));
                decoder!.once('end', resolve);
                decoder!.once('error', reject);
                decoder!.end(body);
            });
            assert.deepStrictEqual(Buffer.concat(parts), text, name);
        }
        assert.strictEqual(contentDecoder(undefined), undefined);
        assert.strictEqual(contentDecoder('identity'), undefined);
        assert.ok(contentDecoder(['gzip']));
    });

    it('keeps as many idle connections for reuse as it may open', () => {
        const agents = new HttpClient() as unknown as { direct: https.Agent };
        assert.strictEqual(agents.direct.maxSockets, 256);
        assert.strictEqual(agents.direct.maxFreeSockets, 256);
        const limited = new HttpClient({ maxSockets: 50 }) as unknown as { direct: https.Agent };
        assert.strictEqual(limited.direct.maxFreeSockets, 50);
    });
});
