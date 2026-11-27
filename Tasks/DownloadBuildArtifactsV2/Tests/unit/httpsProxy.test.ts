import * as assert from 'assert';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as net from 'net';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { Identity, createTestCertificates } from './testCertificates';

describe('a proxy that is given as https://', function () {
    this.timeout(30000);

    // The proxy is known by its address only, the origin by the name localhost only: the certificate of each is valid for its own name and for
    // no other. The proxy is asked for the origin by name, which is the case in practice: a proxy does not carry the name of the sites it serves.
    // The proxy options have an empty bypass list: NO_PROXY of the machine, which often names localhost, must not send a request around the proxy.
    const certificates = createTestCertificates();
    const credentials = { username: 'proxyuser', password: 'p@ss w0rd' };
    const basic = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    const servers: net.Server[] = [];
    let originPort: number;
    let proxyPort: number;
    let nameProxyPort: number;
    let wireTapPort: number;
    let connects: Array<{ target: string; authorization: string | undefined }> = [];
    let sentToProxy: Buffer[] = [];

    const listen = async (server: net.Server): Promise<number> => {
        servers.push(server);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        return (server.address() as AddressInfo).port;
    };

    // A proxy that speaks TLS and tunnels what it is asked for to the origin.
    const startProxy = (identity: Identity) => {
        const proxy = https.createServer({ cert: identity.certificate, key: identity.privateKey });
        proxy.on('tlsClientError', () => undefined);
        proxy.on('connect', (request, clientSocket) => {
            connects.push({ target: String(request.url), authorization: request.headers['proxy-authorization'] });
            const upstream = net.connect(originPort, '127.0.0.1', () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                upstream.pipe(clientSocket);
                clientSocket.pipe(upstream);
            });
            upstream.on('error', () => clientSocket.destroy());
            clientSocket.on('error', () => upstream.destroy());
        });
        return proxy;
    };

    before(async () => {
        originPort = await listen(https.createServer({ cert: certificates.nameServer.certificate, key: certificates.nameServer.privateKey }, (_request, response) => response.end('hello from the origin')));
        proxyPort = await listen(startProxy(certificates.addressServer));
        nameProxyPort = await listen(startProxy(certificates.nameServer));

        // The bytes that cross the network between the client and the proxy.
        wireTapPort = await listen(net.createServer(client => {
            const upstream = net.connect(proxyPort, '127.0.0.1');
            client.on('data', chunk => {
                sentToProxy.push(chunk);
                upstream.write(chunk);
            });
            upstream.on('data', chunk => client.write(chunk));
            client.on('close', () => upstream.destroy());
            upstream.on('close', () => client.destroy());
            client.on('error', () => upstream.destroy());
            upstream.on('error', () => client.destroy());
        }));
    });

    beforeEach(() => {
        connects = [];
        sentToProxy = [];
    });

    after(async () => {
        await Promise.all(servers.map(server => {
            (server as https.Server).closeAllConnections?.();
            return new Promise<void>(resolve => server.close(() => resolve()));
        }));
    });

    const url = () => `https://localhost:${originPort}/`;
    const trusting = { ca: [certificates.authority.certificate] };

    it('is reached over TLS, and its user and password cross the network only inside it', async () => {
        const client = new HttpClient({ ...trusting, proxy: { url: `https://127.0.0.1:${wireTapPort}`, bypass: [], ...credentials } });
        try {
            assert.strictEqual((await client.request(url(), { retries: 0 })).body.toString(), 'hello from the origin');
        } finally {
            client.close();
        }
        assert.deepStrictEqual(connects, [{ target: `localhost:${originPort}`, authorization: basic }]);

        const wire = Buffer.concat(sentToProxy);
        assert.strictEqual(wire[0], 0x16, 'the client starts with a TLS handshake');
        const text = wire.toString('latin1');
        for (const secret of ['CONNECT', 'Proxy-Authorization', credentials.username, basic.substring('Basic '.length)]) {
            assert.ok(!text.includes(secret), `"${secret}" is not in the bytes that the client sent`);
        }
    });

    it('is not trusted when its certificate cannot be verified, and then it is told nothing', async () => {
        const client = new HttpClient({ proxy: { url: `https://127.0.0.1:${proxyPort}`, bypass: [], ...credentials } });
        try {
            await assert.rejects(() => client.request(url(), { retries: 0 }), /certificate|self[- ]signed/i);
        } finally {
            client.close();
        }
        assert.deepStrictEqual(connects, []);
    });

    it('is checked for its own address, not for the name of the site that is asked for', async () => {
        // The certificate of this proxy is valid for the name localhost, the address of the proxy is 127.0.0.1.
        const client = new HttpClient({ ...trusting, proxy: { url: `https://127.0.0.1:${nameProxyPort}`, bypass: [], ...credentials } });
        try {
            await assert.rejects(() => client.request(url(), { retries: 0 }), /altnames|does not match/i);
        } finally {
            client.close();
        }
        assert.deepStrictEqual(connects, []);
    });
});
