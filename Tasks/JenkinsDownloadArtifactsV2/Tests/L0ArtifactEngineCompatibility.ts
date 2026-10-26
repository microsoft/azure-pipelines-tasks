import assert = require('assert');
import fs = require('fs');
import http = require('http');
import os = require('os');
import path = require('path');
import { AddressInfo } from 'net';
import { ArtifactEngineOptions } from 'artifact-engine/Engine/artifactEngineOptions';
import { FilesystemProvider, WebProvider, ZipProvider } from 'artifact-engine/Providers';
import { BasicCredentialHandler } from 'typed-rest-client/Handlers';
import { HttpClient } from 'typed-rest-client/HttpClient';
import { JenkinsRestClient } from '../ArtifactDetails/JenkinsRestClient';
import { getDownloaderOptions } from './L0CommandBlocking';
import { assertDetection, captureEngineOutput, loadArtifactEngine } from './ArtifactEngineOutputTestHelper';

describe('Jenkins artifact-engine v2 compatibility', function () {
    this.timeout(30000);

    const files: { [relativePath: string]: string } = {
        'drop/nested/result.txt': 'artifact contents',
        'drop/skip.txt': 'excluded artifact',
        'drop/result.bin': 'binary artifact',
        'Drop/Mixed.TXT': 'mixed-case artifact'
    };
    const archive = Buffer.from('504b0506000000000000000000000000000000000000', 'hex');
    const handler = new BasicCredentialHandler('username', 'password');
    let server: http.Server;
    let root: string;
    let endpoint: string;
    let requests: { url: string; authorization: string }[];
    let responseStatus: number;
    let fileFailures: number;
    let metadataBody: string;
    const downloadedMarker = 'drop/marker-##vso[task.debug]synthetic.txt';
    const skippedMarker = 'drop/marker-##vso[task.debug]skip.txt';
    let ArtifactEngine: typeof import('artifact-engine/Engine').ArtifactEngine;
    let restoreHandlers: () => void;

    before(async () => {
        ({ ArtifactEngine, restoreHandlers } = await loadArtifactEngine());
    });

    after(() => restoreHandlers());

    beforeEach(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-engine-'));
        requests = [];
        responseStatus = 200;
        fileFailures = 0;
        metadataBody = undefined;
        server = http.createServer((request, response) => {
            requests.push({ url: request.url, authorization: request.headers.authorization });
            response.setHeader('Connection', 'close');
            if (request.headers.authorization !== 'Basic ' + Buffer.from('username:password').toString('base64')) {
                response.writeHead(401);
                response.end('Authentication required');
            } else if (responseStatus !== 200) {
                response.writeHead(responseStatus);
                response.end('Request failed');
            } else if (request.url.indexOf('/api/json') !== -1) {
                response.setHeader('Content-Type', 'application/json');
                response.end(metadataBody === undefined
                    ? JSON.stringify({ artifacts: Object.keys(files).map(relativePath => ({ relativePath })) })
                    : metadataBody);
            } else if (request.url.indexOf('/artifact/*zip*/') !== -1) {
                response.end(archive);
            } else if (fileFailures > 0) {
                fileFailures--;
                response.writeHead(503);
                response.end('Try again');
            } else {
                // A fragment in the synthetic download URL is not sent over HTTP.
                const relativePath = request.url.indexOf('/artifact/drop/marker-') !== -1
                    ? downloadedMarker : request.url.split('/artifact/')[1];
                if (Object.prototype.hasOwnProperty.call(files, relativePath)) {
                    response.end(files[relativePath]);
                } else {
                    response.writeHead(404);
                    response.end('Not found');
                }
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
            delete files[downloadedMarker];
            delete files[skippedMarker];
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

    function options(itemPattern: string): ArtifactEngineOptions {
        const result = new ArtifactEngineOptions();
        result.itemPattern = itemPattern;
        result.retryLimit = 1;
        result.retryIntervalInSeconds = 0;
        return result;
    }

    async function taskOptions(pattern: string, flag: string) {
        const result = await getDownloaderOptions(pattern, flag, '4', 'false');
        // Exercise failures without leaving production retry timers beyond the test lifetime.
        result.retryLimit = 1;
        result.retryIntervalInSeconds = 0;
        return result;
    }

    it('reads Jenkins metadata with the replacement HTTP client and basic authentication', async () => {
        const client = new HttpClient('JenkinsRestClient', [handler], { ignoreSslError: false });
        try {
            const result = await new JenkinsRestClient().DownloadJsonContentWithRetries(
                client, `${endpoint}/job/example/42/api/json?tree=artifacts[*]`, null, null);
            assert.deepStrictEqual(result.artifacts.map(artifact => artifact.relativePath), Object.keys(files));
            assert.strictEqual(requests.length, 1);
        } finally {
            client.dispose();
        }
    });

    it('downloads nested artifacts using the Jenkins template, include/exclude patterns and basic authentication', async () => {
        await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root),
            options('drop/nested/**/*.txt\ndrop/skip.txt\n!drop/skip.txt'));

        assert.strictEqual(fs.readFileSync(path.join(root, 'drop', 'nested', 'result.txt'), 'utf8'), files['drop/nested/result.txt']);
        assert.strictEqual(fs.existsSync(path.join(root, 'drop', 'skip.txt')), false);
        assert.strictEqual(fs.existsSync(path.join(root, 'drop', 'result.bin')), false);
        assert.strictEqual(requests.length, 2);
        assert.strictEqual(requests[1].url, '/job/example/42/artifact/drop/nested/result.txt');
    });

    it('downloads the complete Jenkins ZIP archive without changing its bytes', async () => {
        const archivePath = path.join(root, 'archive.zip');
        await new ArtifactEngine().processItems(
            new ZipProvider(`${endpoint}/job/example/42/artifact/*zip*/`, handler, { ignoreSslError: false }),
            new FilesystemProvider(archivePath), options('**'));

        assert.deepStrictEqual(fs.readFileSync(archivePath), archive);
        assert.strictEqual(requests.length, 1);
    });

    it('matches case according to the destination platform without a feature flag', async () => {
        const destination = new FilesystemProvider(root);
        const caseInsensitive = process.platform === 'win32' ||
            (process.platform === 'darwin' && destination.isCaseInsensitiveFilesystem());
        await new ArtifactEngine().processItems(webProvider(), destination, options('drop/mixed.txt'));

        const downloaded = path.join(root, 'Drop', 'Mixed.TXT');
        assert.strictEqual(fs.existsSync(downloaded), caseInsensitive);
        if (caseInsensitive) {
            assert.strictEqual(fs.readFileSync(downloaded, 'utf8'), files['Drop/Mixed.TXT']);
        }
    });

    it('applies the same case rules to exclusion patterns', async () => {
        const destination = new FilesystemProvider(root);
        const caseInsensitive = process.platform === 'win32' ||
            (process.platform === 'darwin' && destination.isCaseInsensitiveFilesystem());
        await new ArtifactEngine().processItems(webProvider(), destination, options('**\n!drop/mixed.txt'));

        assert.strictEqual(fs.existsSync(path.join(root, 'Drop', 'Mixed.TXT')), !caseInsensitive);
        assert.strictEqual(fs.readFileSync(path.join(root, 'drop', 'nested', 'result.txt'), 'utf8'), files['drop/nested/result.txt']);
    });

    it('rejects HTTP errors when retrieving artifact metadata', async () => {
        responseStatus = 401;
        await assert.rejects(
            new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), options('**')),
            error => error['statusCode'] === 401);
    });

    it('rejects HTTP errors when downloading an archive', async () => {
        responseStatus = 404;
        await assert.rejects(new ArtifactEngine().processItems(
            new ZipProvider(`${endpoint}/job/example/42/artifact/*zip*/`, handler),
            new FilesystemProvider(path.join(root, 'archive.zip')), options('**')),
            error => error['statusCode'] === 404);
    });

    it('retries a failed artifact download and preserves its contents', async () => {
        fileFailures = 1;
        const downloadOptions = options('drop/nested/result.txt');
        downloadOptions.retryLimit = 2;
        await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

        assert.strictEqual(fs.readFileSync(path.join(root, 'drop', 'nested', 'result.txt'), 'utf8'), files['drop/nested/result.txt']);
        assert.strictEqual(requests.length, 3);
    });

    for (const gate of [false, true]) {
        for (const flag of ['false', 'true']) {
            it(`preserves paths and bytes with engine gate ${gate} and command flag ${flag}`, async () => {
                files[downloadedMarker] = 'synthetic artifact bytes';
                files[skippedMarker] = 'excluded synthetic artifact';
                const downloadOptions = await taskOptions('drop/*.txt\n!drop/*skip.txt', flag);
                const output = await captureEngineOutput(gate, async () => {
                    const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
                    assert(tickets.some(ticket => ticket.artifactItem.path === downloadedMarker));
                    assert(tickets.some(ticket => ticket.artifactItem.path === skippedMarker));
                });

                assert.strictEqual(fs.readFileSync(path.join(root, downloadedMarker), 'utf8'), files[downloadedMarker]);
                assert.strictEqual(fs.existsSync(path.join(root, skippedMarker)), false);
                const blocked = flag === 'true';
                const ordinaryMarker = !gate || blocked ? '##_vso[task.debug]skip.txt' : '##vso[task.debug]skip.txt';
                assert(output.ordinary.some(line => line.indexOf(ordinaryMarker) !== -1), output.ordinary.join('\n'));
                if (output.debugEnabled) {
                    // Legacy V2 blocks ordinary output, but its debug logger retains embedded markers.
                    const debugMarker = gate && blocked ? '##_vso[task.debug]synthetic.txt' : '##vso[task.debug]synthetic.txt';
                    assert(output.debug.some(line => line.indexOf('Processing ') !== -1 && line.indexOf(debugMarker) !== -1));
                } else {
                    assert.strictEqual(output.debug.length, 0);
                }
                assertDetection(output, gate, blocked);
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
                const marker = !gate || flag === 'true' ? '##_vso[task.debug]' : '##vso[task.debug]';
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
            assert.strictEqual(output.detection.length, 0, 'a harmless ZIP must not cause command detection');
            assert.strictEqual(output.performance.length, 1);
        });
    }
});
