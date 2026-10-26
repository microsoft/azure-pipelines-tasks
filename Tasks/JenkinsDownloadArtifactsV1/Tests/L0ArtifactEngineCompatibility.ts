import assert = require('assert');
import fs = require('fs');
import http = require('http');
import os = require('os');
import path = require('path');
import { AddressInfo } from 'net';
import { FilesystemProvider, WebProvider, ZipProvider } from 'artifact-engine/Providers';
import { BasicCredentialHandler } from 'artifact-engine/Providers/typed-rest-client/Handlers';
import { getDownloaderOptions } from './L0CommandBlocking';
import { assertDetection, captureEngineOutput, loadArtifactEngine } from './ArtifactEngineOutputTestHelper';

describe('Jenkins artifact-engine v1 external output compatibility', function () {
    this.timeout(30000);

    const downloadedMarker = 'drop/marker-##vso[task.debug]synthetic.txt';
    const skippedMarker = 'drop/marker-##vso[task.debug]skip.txt';
    const contents = Buffer.from('synthetic artifact bytes');
    const archive = Buffer.from('504b0506000000000000000000000000000000000000', 'hex');
    const handler = new BasicCredentialHandler('username', 'password');
    let server: http.Server;
    let root: string;
    let endpoint: string;
    let metadataBody: string;
    let requests: string[];
    let ArtifactEngine: typeof import('artifact-engine/Engine').ArtifactEngine;
    let restoreHandlers: () => void;

    before(async () => {
        ({ ArtifactEngine, restoreHandlers } = await loadArtifactEngine());
    });

    after(() => restoreHandlers());

    beforeEach(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-engine-v1-'));
        metadataBody = JSON.stringify({
            artifacts: [downloadedMarker, skippedMarker].map(relativePath => ({ relativePath }))
        });
        requests = [];
        server = http.createServer((request, response) => {
            requests.push(request.url);
            response.setHeader('Connection', 'close');
            if (request.headers.authorization !== 'Basic ' + Buffer.from('username:password').toString('base64')) {
                response.writeHead(401);
                response.end('Authentication required');
            } else if (request.url.indexOf('/api/json') !== -1) {
                response.setHeader('Content-Type', 'application/json');
                response.end(metadataBody);
            } else if (request.url.indexOf('/artifact/*zip*/') !== -1) {
                response.end(archive);
            } else if (request.url.indexOf('/artifact/drop/marker-') !== -1) {
                // A fragment in the synthetic download URL is not sent over HTTP.
                response.end(contents);
            } else {
                response.writeHead(404);
                response.end('Not found');
            }
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
        try {
            await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    function webProvider(): WebProvider {
        return new WebProvider(
            `${endpoint}/job/example/42/api/json?tree=artifacts[*]`,
            path.join(__dirname, '..', 'jenkins.handlebars.txt'),
            {
                endpoint: { url: endpoint },
                jobUrlInfix: '/job/example',
                multibranchPipelineUrlInfix: '',
                version: 42
            },
            handler,
            { ignoreSslError: false });
    }

    async function taskOptions(pattern: string, flag: string) {
        const result = await getDownloaderOptions(pattern, flag, '4', 'false');
        // Exercise failures without leaving production retry timers beyond the test lifetime.
        result.retryLimit = 1;
        result.retryIntervalInSeconds = 0;
        return result;
    }

    for (const gate of [false, true]) {
        for (const flag of ['false', 'true']) {
            it(`preserves paths and bytes with engine gate ${gate} and command flag ${flag}`, async () => {
                const downloadOptions = await taskOptions('drop/*.txt\n!drop/*skip.txt', flag);
                const output = await captureEngineOutput(gate, async () => {
                    const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
                    assert(tickets.some(ticket => ticket.artifactItem.path === downloadedMarker));
                    assert(tickets.some(ticket => ticket.artifactItem.path === skippedMarker));
                });

                assert.deepStrictEqual(fs.readFileSync(path.join(root, downloadedMarker)), contents);
                assert.strictEqual(fs.existsSync(path.join(root, skippedMarker)), false);
                assert.strictEqual(requests.length, 2);
                const blocked = gate && flag === 'true';
                const ordinaryMarker = blocked ? '##_vso[task.debug]skip.txt' : '##vso[task.debug]skip.txt';
                assert(output.ordinary.some(line => line.indexOf(ordinaryMarker) !== -1), output.ordinary.join('\n'));
                if (output.debugEnabled) {
                    const debugMarker = blocked ? '##_vso[task.debug]synthetic.txt' : '##vso[task.debug]synthetic.txt';
                    assert(output.debug.some(line => line.indexOf('Processing ') !== -1 && line.indexOf(debugMarker) !== -1));
                } else {
                    assert.strictEqual(output.debug.length, 0);
                }
                assertDetection(output, gate, flag === 'true');
                assert.strictEqual(output.performance.length, 1, 'trusted engine performance telemetry must remain an agent command');
            });

            it(`preserves malformed-response failures with engine gate ${gate} and command flag ${flag}`, async () => {
                metadataBody = 'not-json\nremote detail: ##vso[task.debug]synthetic remote response';
                const downloadOptions = await taskOptions('drop/*.txt', flag);
                const output = await captureEngineOutput(gate, async () => {
                    await assert.rejects(
                        new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions),
                        error => error instanceof SyntaxError);
                });
                const marker = gate && flag === 'true' ? '##_vso[task.debug]' : '##vso[task.debug]';
                assert(output.ordinary.some(line => line.indexOf(marker + 'synthetic remote response') !== -1));
                assertDetection(output, gate, flag === 'true');
                assert.strictEqual(output.performance.length, 0);
            });
        }
    }

    for (const flag of ['false', 'true']) {
        it(`uses task ZIP options with the real engine when the command flag is ${flag}`, async () => {
            const downloadOptions = await taskOptions('**', flag);
            const archivePath = path.join(root, 'archive.zip');
            const output = await captureEngineOutput(true, async () => {
                await new ArtifactEngine().processItems(
                    new ZipProvider(`${endpoint}/job/example/42/artifact/*zip*/`, handler),
                    new FilesystemProvider(archivePath), downloadOptions);
            });
            assert.deepStrictEqual(fs.readFileSync(archivePath), archive);
            assert.strictEqual(requests.length, 1);
            assert.strictEqual(output.detection.length, 0, 'a harmless ZIP must not cause command detection');
            assert.strictEqual(output.performance.length, 1);
        });
    }
});
