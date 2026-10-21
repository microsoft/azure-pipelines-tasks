import assert = require('assert');
import fs = require('fs');
import http = require('http');
import os = require('os');
import path = require('path');
import { AddressInfo } from 'net';
import { ArtifactEngine, ArtifactEngineOptions } from 'artifact-engine/Engine';
import { FilesystemProvider, WebProvider, ZipProvider } from 'artifact-engine/Providers';
import { BasicCredentialHandler } from 'typed-rest-client/Handlers';
import { HttpClient } from 'typed-rest-client/HttpClient';
import { JenkinsRestClient } from '../ArtifactDetails/JenkinsRestClient';

describe('Jenkins artifact-engine v2 compatibility', function () {
    this.timeout(10000);

    const files = {
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

    beforeEach(async () => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-engine-'));
        requests = [];
        responseStatus = 200;
        fileFailures = 0;
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
                response.end(JSON.stringify({ artifacts: Object.keys(files).map(relativePath => ({ relativePath })) }));
            } else if (request.url.indexOf('/artifact/*zip*/') !== -1) {
                response.end(archive);
            } else if (fileFailures > 0) {
                fileFailures--;
                response.writeHead(503);
                response.end('Try again');
            } else {
                const relativePath = request.url.split('/artifact/')[1];
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
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        fs.rmSync(root, { recursive: true, force: true });
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
});
