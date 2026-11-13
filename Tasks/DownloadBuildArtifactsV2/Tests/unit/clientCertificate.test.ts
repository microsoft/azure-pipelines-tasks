import * as assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as tls from 'tls';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { readClientCertificate } from '../../DownloadEngine/http/clientCertificate';
import { Logger } from '../../DownloadEngine/util/logger';
import { createTestCertificates } from './testCertificates';

describe('client certificate', function () {
    this.timeout(30000);

    const certificates = createTestCertificates();
    let server: https.Server;
    let port: number;
    let proxy: http.Server;
    let proxyPort: number;
    let tunnels = 0;

    // The server asks every client for a certificate of its authority and answers with the name that the certificate holds.
    before(async () => {
        server = https.createServer({
            cert: certificates.server.certificate,
            key: certificates.server.privateKey,
            ca: [certificates.authority.certificate],
            requestCert: true,
            rejectUnauthorized: true
        }, (req, res) => {
            const peer = (req.socket as tls.TLSSocket).getPeerCertificate();
            res.end(`hello ${peer.subject?.CN ?? 'nobody'}`);
        });
        server.on('tlsClientError', () => undefined);
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        port = (server.address() as AddressInfo).port;

        // A proxy that only tunnels: the client talks TLS to the server through it, so it cannot see the certificate.
        proxy = http.createServer();
        proxy.on('connect', (request, clientSocket) => {
            tunnels++;
            const [host, targetPort] = String(request.url).split(':');
            const upstream = net.connect(Number(targetPort), host, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                upstream.pipe(clientSocket);
                clientSocket.pipe(upstream);
            });
            upstream.on('error', () => clientSocket.destroy());
            clientSocket.on('error', () => upstream.destroy());
        });
        await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
        proxyPort = (proxy.address() as AddressInfo).port;
    });

    after(async () => {
        server.closeAllConnections?.();
        proxy.closeAllConnections?.();
        await Promise.all([
            new Promise<void>(resolve => server.close(() => resolve())),
            new Promise<void>(resolve => proxy.close(() => resolve()))
        ]);
    });

    const url = () => `https://127.0.0.1:${port}/`;
    const trusting = { ca: [certificates.authority.certificate] };
    const clientCertificate = { cert: certificates.client.certificate, key: certificates.client.privateKey };

    async function body(client: HttpClient): Promise<string> {
        try {
            return (await client.request(url(), { retries: 0 })).body.toString();
        } finally {
            client.close();
        }
    }

    it('is shown to a server that asks for one', async () => {
        assert.strictEqual(await body(new HttpClient({ ...trusting, clientCertificate })), 'hello test client');
    });

    it('can have a private key that is protected by a password', async () => {
        const protectedKey = { cert: certificates.client.certificate, key: certificates.client.encryptedPrivateKey, passphrase: 'secret' };
        assert.strictEqual(await body(new HttpClient({ ...trusting, clientCertificate: protectedKey })), 'hello test client');
    });

    it('is not invented: without one, or with one of another authority, the server refuses the connection', async () => {
        await assert.rejects(() => body(new HttpClient({ ...trusting })));
        const foreign = { cert: certificates.otherClient.certificate, key: certificates.otherClient.privateKey };
        await assert.rejects(() => body(new HttpClient({ ...trusting, clientCertificate: foreign })));
    });

    it('fails when the client is built with a wrong password, and says that the client certificate is the problem', () => {
        const wrong = { cert: certificates.client.certificate, key: certificates.client.encryptedPrivateKey, passphrase: 'wrong' };
        assert.throws(() => new HttpClient({ ...trusting, clientCertificate: wrong }), /client certificate of the agent cannot be used/);
        const missing = { cert: certificates.client.certificate, key: certificates.client.encryptedPrivateKey };
        assert.throws(() => new HttpClient({ ...trusting, clientCertificate: missing }), /client certificate of the agent cannot be used/);
    });

    it('is also shown through a proxy', async () => {
        const before = tunnels;
        // An empty bypass list: NO_PROXY of the machine, which often names 127.0.0.1, must not send the request around the proxy.
        const through = new HttpClient({ ...trusting, clientCertificate, proxy: { url: `http://127.0.0.1:${proxyPort}`, bypass: [] } });
        assert.strictEqual(await body(through), 'hello test client');
        assert.strictEqual(tunnels, before + 1);
    });

    it('goes to a worker thread as text, and the client that is built from it shows it as well', async () => {
        const client = new HttpClient({ ...trusting, clientCertificate: { cert: Buffer.from(certificates.client.certificate), key: certificates.client.encryptedPrivateKey, passphrase: 'secret' } });
        const exported = client.workerOptions();
        client.close();
        assert.deepStrictEqual(exported.clientCertificate, { cert: certificates.client.certificate, key: certificates.client.encryptedPrivateKey, passphrase: 'secret' });
        assert.doesNotThrow(() => JSON.stringify(exported));
        assert.strictEqual(await body(new HttpClient(exported)), 'hello test client');

        const without = new HttpClient({ ...trusting });
        assert.ok(!('clientCertificate' in without.workerOptions()));
        without.close();
    });

    describe('settings of the agent', () => {
        let folder: string;
        const warnings: string[] = [];
        const logger: Logger = { debug: () => undefined, info: () => undefined, warning: message => warnings.push(message), error: () => undefined };

        beforeEach(() => {
            warnings.length = 0;
            folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-clientcert-'));
        });

        afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

        it('are read from the certificate file and the key file', () => {
            const certFile = path.join(folder, 'client.pem');
            const keyFile = path.join(folder, 'client.key');
            fs.writeFileSync(certFile, certificates.client.certificate);
            fs.writeFileSync(keyFile, certificates.client.encryptedPrivateKey);

            const read = readClientCertificate({ certFile, keyFile, passphrase: 'secret' }, logger)!;
            assert.strictEqual(read.cert.toString(), certificates.client.certificate);
            assert.strictEqual(read.key.toString(), certificates.client.encryptedPrivateKey);
            assert.strictEqual(read.passphrase, 'secret');
            assert.strictEqual(readClientCertificate({ certFile, keyFile, passphrase: '' }, logger)!.passphrase, undefined);
            assert.deepStrictEqual(warnings.slice(), []);
        });

        it('mean no certificate when the agent has none, and a warning when a file is missing', () => {
            assert.strictEqual(readClientCertificate(null, logger), undefined);
            assert.strictEqual(readClientCertificate({}, logger), undefined);
            assert.strictEqual(readClientCertificate({ certFile: path.join(folder, 'client.pem') }, logger), undefined);
            assert.deepStrictEqual(warnings.slice(), []);

            const certFile = path.join(folder, 'client.pem');
            fs.writeFileSync(certFile, certificates.client.certificate);
            assert.strictEqual(readClientCertificate({ certFile, keyFile: path.join(folder, 'missing.key') }, logger), undefined);
            assert.strictEqual(warnings.length, 1);
            assert.ok(!warnings.join('\n').includes(folder), 'the warning does not repeat paths');
        });
    });
});
