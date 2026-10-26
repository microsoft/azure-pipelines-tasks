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
            } else if (request.url.indexOf('/artifact/') !== -1) {
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
        new (require('../ArtifactDetails/JenkinsRestClient').JenkinsRestClient)();
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

    describe('artifact path encoding and audit modes', () => {
        const encodingFeatureVar = 'DISTRIBUTEDTASK_TASKS_ENABLEJENKINSARTIFACTPATHENCODING';
        const auditFeatureVar = 'DISTRIBUTEDTASK_TASKS_ENABLEJENKINSARTIFACTPATHAUDIT';
        let secondaryServer: http.Server;
        let secondaryEndpoint: string;
        let secondaryPort: number;
        let secondaryRequests: { url: string; authorization: string }[];
        let originalEncodingVar: string;
        let originalAuditVar: string;

        beforeEach(async () => {
            originalEncodingVar = process.env[encodingFeatureVar];
            originalAuditVar = process.env[auditFeatureVar];
            delete process.env[encodingFeatureVar];
            delete process.env[auditFeatureVar];
            new (require('../ArtifactDetails/JenkinsRestClient').JenkinsRestClient)();

            secondaryRequests = [];
            secondaryServer = http.createServer((request, response) => {
                secondaryRequests.push({ url: request.url, authorization: request.headers.authorization });
                response.setHeader('Connection', 'close');
                response.end('secondary-endpoint-content');
            });
            await new Promise<void>(resolve => secondaryServer.listen(0, '127.0.0.1', resolve));
            secondaryPort = (secondaryServer.address() as AddressInfo).port;
            secondaryEndpoint = `http://127.0.0.1:${secondaryPort}`;
        });

        afterEach(async () => {
            if (originalEncodingVar === undefined) {
                delete process.env[encodingFeatureVar];
            } else {
                process.env[encodingFeatureVar] = originalEncodingVar;
            }
            if (originalAuditVar === undefined) {
                delete process.env[auditFeatureVar];
            } else {
                process.env[auditFeatureVar] = originalAuditVar;
            }
            await new Promise<void>((resolve, reject) => secondaryServer.close(error => error ? reject(error) : resolve()));
        });

        function setFlags(encoding?: string, audit?: string): void {
            if (encoding === undefined) {
                delete process.env[encodingFeatureVar];
            } else {
                process.env[encodingFeatureVar] = encoding;
            }
            if (audit === undefined) {
                delete process.env[auditFeatureVar];
            } else {
                process.env[auditFeatureVar] = audit;
            }
        }

        for (const offState of [undefined, 'false']) {
            it(`reproduces baseline backslash-normalized metadata override when encoding is ${offState}`, async () => {
                setFlags(offState, 'false');
                const relativePath = `release.zip","downloadUrl":"http:${'\\'.repeat(4)}127.0.0.1:${secondaryPort}","z":"safe`;
                metadataBody = JSON.stringify({ artifacts: [{ relativePath }] });
                const downloadOptions = await taskOptions('*.zip', 'false');

                await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

                assert.strictEqual(secondaryRequests.length, 1);
                assert.strictEqual(secondaryRequests[0].url, '/');
                assert.strictEqual(secondaryRequests[0].authorization, 'Basic ' + Buffer.from('username:password').toString('base64'));
                assert.strictEqual(fs.readFileSync(path.join(root, 'release.zip'), 'utf8'), 'secondary-endpoint-content');
            });

            it(`reproduces baseline unicode-escaped metadata override when encoding is ${offState}`, async () => {
                setFlags(offState, 'false');
                const relativePath = `drop/nested/result.txt","downloadUrl":"http:\\u002f\\u002f127.0.0.1:${secondaryPort}\\u002fsentinel`;
                metadataBody = JSON.stringify({ artifacts: [{ relativePath }] });
                const downloadOptions = await taskOptions('drop/nested/**', 'false');

                await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

                assert.strictEqual(secondaryRequests.length, 1);
                assert.strictEqual(secondaryRequests[0].url, '/sentinel');
                assert.strictEqual(secondaryRequests[0].authorization, 'Basic ' + Buffer.from('username:password').toString('base64'));
            });
        }

        async function captureAuditEvents(action: () => Promise<void>): Promise<string[]> {
            const lines: string[] = [];
            const originalLog = console.log;
            console.log = (...args: any[]) => {
                const text = args.map(a => String(a)).join(' ');
                if (text.indexOf('feature=artifactPathEncodingAudit]') !== -1) {
                    lines.push(text);
                }
                originalLog.apply(console, args);
            };
            try {
                await action();
                return lines;
            } finally {
                console.log = originalLog;
            }
        }

        it('keeps backslash-containing metadata on the configured endpoint when encoding is enabled', async () => {
            setFlags('true', 'false');
            const relativePath = `release.zip","downloadUrl":"http:${'\\'.repeat(4)}127.0.0.1:${secondaryPort}","z":"safe`;
            metadataBody = JSON.stringify({ artifacts: [{ relativePath }] });
            const downloadOptions = await taskOptions('*.zip', 'true');

            const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

            assert.strictEqual(secondaryRequests.length, 0, 'secondary endpoint must receive no requests');
            const fileTickets = tickets.filter(t => t.artifactItem.path !== '');
            assert.strictEqual(fileTickets.length, 1);
            assert.strictEqual(fileTickets[0].artifactItem.path, relativePath);
            assert(fileTickets[0].artifactItem.metadata['downloadUrl'].indexOf(endpoint + '/job/example//42/artifact/') === 0);
        });

        it('keeps unicode-escape metadata on the configured endpoint when encoding is enabled', async () => {
            setFlags('true', 'false');
            const relativePath = `drop/nested/result.txt","downloadUrl":"http:\\u002f\\u002f127.0.0.1:${secondaryPort}\\u002fsentinel`;
            metadataBody = JSON.stringify({ artifacts: [{ relativePath }] });
            const downloadOptions = await taskOptions('!drop/**', 'true');

            const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

            assert.strictEqual(secondaryRequests.length, 0, 'secondary endpoint must receive no requests');
            const fileTickets = tickets.filter(t => t.artifactItem.path !== '');
            assert.strictEqual(fileTickets.length, 1);
            assert.strictEqual(fileTickets[0].artifactItem.path, relativePath);
            assert(fileTickets[0].artifactItem.metadata['downloadUrl'].indexOf(endpoint + '/job/example//42/artifact/drop/nested/') === 0);
            assert(fileTickets[0].artifactItem.metadata['downloadUrl'].indexOf('%22') !== -1);
            assert(fileTickets[0].artifactItem.metadata['downloadUrl'].indexOf('%5C') !== -1);
        });

        it('prevents multi-item JSON breakout and neutralizes skipped command markers when encoding is enabled', async () => {
            setFlags('true', 'false');
            const relativePath = `release.zip","metadata":{"downloadUrl":"http:\\u002f\\u002f127.0.0.1:${secondaryPort}\\u002fpayload"}},{"path":"drop/##vso[task.setvariable variable=NODE_OPTIONS]synthetic","itemType":"file","metadata":{"downloadUrl":"${endpoint}\\u002funused`;
            metadataBody = JSON.stringify({ artifacts: [{ relativePath }] });
            const downloadOptions = await taskOptions('!release.zip*', 'true');

            const output = await captureEngineOutput(true, async () => {
                const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
                const fileTickets = tickets.filter(t => t.artifactItem.path !== '');
                assert.strictEqual(fileTickets.length, 1, 'must not inject a second artifact item');
                assert.strictEqual(fileTickets[0].artifactItem.path, relativePath);
            });

            assert.strictEqual(secondaryRequests.length, 0, 'secondary endpoint must receive no requests');
            assert(output.ordinary.every(line => line.indexOf('##vso[task.setvariable') === -1));
        });

        it('encodes URL-special filename segments while preserving path separators and normal downloads', async () => {
            setFlags('true', 'false');
            const downloadablePath = 'drop/nested/build #42 100% done.txt';
            const excludedQueryPath = 'drop/excluded/file?rev=1&part=a.txt';
            metadataBody = JSON.stringify({
                artifacts: [
                    { relativePath: downloadablePath },
                    { relativePath: excludedQueryPath }
                ]
            });
            const downloadOptions = await taskOptions('drop/nested/**\n!drop/excluded/**', 'true');

            const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
            const fileTickets = tickets.filter(t => t.artifactItem.path !== '');
            assert.strictEqual(fileTickets.length, 2);

            const downloadedTicket = fileTickets.find(t => t.artifactItem.path === downloadablePath);
            assert(downloadedTicket, 'expected downloadable ticket');
            assert.strictEqual(
                downloadedTicket.artifactItem.metadata['downloadUrl'],
                `${endpoint}/job/example//42/artifact/drop/nested/build%20%2342%20100%25%20done.txt`);
            assert(requests.indexOf('/job/example/42/artifact/drop/nested/build%20%2342%20100%25%20done.txt') !== -1, requests.join('\n'));
            assert.deepStrictEqual(fs.readFileSync(path.join(root, 'drop', 'nested', 'build #42 100% done.txt')), contents);

            const excludedTicket = fileTickets.find(t => t.artifactItem.path === excludedQueryPath);
            assert(excludedTicket, 'expected excluded ticket');
            assert.strictEqual(
                excludedTicket.artifactItem.metadata['downloadUrl'],
                `${endpoint}/job/example//42/artifact/drop/excluded/file%3Frev%3D1%26part%3Da.txt`);
        });

        it('emits bounded wouldEncode audit telemetry without altering baseline behavior when only audit is enabled', async () => {
            setFlags('false', 'true');
            const relativePath = 'drop/nested/file"quote\\slash.txt';
            metadataBody = JSON.stringify({
                artifacts: [
                    { relativePath: 'drop/nested/ordinary.txt' },
                    { relativePath }
                ]
            });
            const downloadOptions = await taskOptions('!drop/**', 'true');
            downloadOptions.retryLimit = 3;

            const auditLines = await captureAuditEvents(async () => {
                // With encoding off, raw quote in relativePath causes JSON.parse to fail as in baseline.
                await assert.rejects(
                    new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions),
                    error => error instanceof SyntaxError);
            });

            assert.strictEqual(auditLines.length, 1, 'must emit exactly one deduplicated audit event across retries');
            assert(auditLines[0].indexOf('"encodingEnabled":false') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"auditEnabled":true') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"decision":"wouldEncode"') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"version":{"Major":1,"Minor":282,"Patch":4}') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"totalArtifacts":2') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"jsonSpecialCount":1') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"hasQuote":true') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"hasBackslash":true') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('file"quote') === -1, 'audit event must never contain raw filenames');
        });

        it('emits bounded encoded audit telemetry when encoding is enabled', async () => {
            for (const auditFlag of ['false', 'true']) {
                setFlags('true', auditFlag);
                const relativePath = 'drop/nested/file"quote\\slash.txt';
                metadataBody = JSON.stringify({
                    artifacts: [
                        { relativePath: 'drop/nested/ordinary.txt' },
                        { relativePath }
                    ]
                });
                const downloadOptions = await taskOptions('!drop/**', 'true');

                const auditLines = await captureAuditEvents(async () => {
                    const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
                    assert.strictEqual(tickets.filter(t => t.artifactItem.path !== '').length, 2);
                });

                assert.strictEqual(auditLines.length, 1);
                assert(auditLines[0].indexOf('"encodingEnabled":true') !== -1, auditLines[0]);
                assert(auditLines[0].indexOf(`"auditEnabled":${auditFlag}`) !== -1, auditLines[0]);
                assert(auditLines[0].indexOf('"decision":"encoded"') !== -1, auditLines[0]);
                assert(auditLines[0].indexOf('"version":{"Major":1,"Minor":282,"Patch":4}') !== -1, auditLines[0]);
                assert(auditLines[0].indexOf('"totalArtifacts":2') !== -1, auditLines[0]);
                assert(auditLines[0].indexOf('"jsonSpecialCount":1') !== -1, auditLines[0]);
                assert(auditLines[0].indexOf('file"quote') === -1, 'audit event must never contain raw filenames');
            }
        });

        it('emits no audit telemetry when both encoding and audit flags are disabled', async () => {
            setFlags('false', 'false');
            metadataBody = JSON.stringify({ artifacts: [{ relativePath: 'drop/nested/ordinary.txt' }] });
            const downloadOptions = await taskOptions('!drop/**', 'true');

            const auditLines = await captureAuditEvents(async () => {
                await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
            });

            assert.strictEqual(auditLines.length, 0);
        });

        it('locks the pipeline feature flag names for encoding and audit', () => {
            const { JenkinsRestClient } = require('../ArtifactDetails/JenkinsRestClient');
            assert.strictEqual(JenkinsRestClient.ArtifactPathEncodingFeature, 'EnableJenkinsArtifactPathEncoding');
            assert.strictEqual(JenkinsRestClient.ArtifactPathAuditFeature, 'EnableJenkinsArtifactPathAudit');
        });

        it('coerces non-string relativePath values such as arrays when encoding is enabled', async () => {
            setFlags('true', 'false');
            const nestedArrayPath = [`release.zip","downloadUrl":"http:${'\\'.repeat(4)}127.0.0.1:${secondaryPort}","z":"safe`];
            metadataBody = JSON.stringify({ artifacts: [{ relativePath: nestedArrayPath }] });
            const downloadOptions = await taskOptions('*.zip', 'true');

            const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);

            assert.strictEqual(secondaryRequests.length, 0, 'secondary endpoint must receive no requests for array-coerced relativePath');
            const fileTickets = tickets.filter(t => t.artifactItem.path !== '');
            assert.strictEqual(fileTickets.length, 1);
            assert.strictEqual(fileTickets[0].artifactItem.path, String(nestedArrayPath));
            assert(fileTickets[0].artifactItem.metadata['downloadUrl'].indexOf(endpoint + '/job/example//42/artifact/') === 0);
        });

        it('handles unpaired UTF-16 surrogates and null boundary items safely during audit', async () => {
            setFlags('false', 'true');
            const surrogatePath = 'drop/nested/surrogate-\uD800-item.txt';
            metadataBody = JSON.stringify({
                artifacts: [
                    { relativePath: null },
                    { relativePath: surrogatePath },
                    { relativePath: undefined }
                ]
            });
            const downloadOptions = await taskOptions('!drop/**', 'true');

            const auditLines = await captureAuditEvents(async () => {
                const tickets = await new ArtifactEngine().processItems(webProvider(), new FilesystemProvider(root), downloadOptions);
                assert(tickets.length >= 1);
            });

            assert.strictEqual(auditLines.length, 1, 'must emit audit summary even when first/last items are null/undefined or contain lone surrogates');
            assert(auditLines[0].indexOf('"totalArtifacts":3') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"encodingErrorCount":1') !== -1, auditLines[0]);
            assert(auditLines[0].indexOf('"decision":"wouldEncode"') !== -1, auditLines[0]);
        });
    });
});
