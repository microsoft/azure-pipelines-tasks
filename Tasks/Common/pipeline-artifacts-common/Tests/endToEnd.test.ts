import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildClient } from '../src/build/buildClient';
import { HttpClient } from '../src/http/httpClient';
import { IntegrityError } from '../src/errors';
import { PipelineArtifactProvider } from '../src/providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters } from '../src/providers/types';
import { publishPipelineArtifact } from '../src/publishing/publishPipelineArtifact';
import { Logger } from '../src/util/logger';
import { FakeService } from './fakeService';
import { seeded } from './testUtil';

const logs: string[] = [];
const logger: Logger = {
    debug: message => logs.push(`[debug] ${message}`),
    info: message => logs.push(message),
    warning: message => logs.push(`[warning] ${message}`),
    error: message => logs.push(`[error] ${message}`)
};

function temporaryDirectory(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `pac-${name}-`));
}

function writeTree(root: string, files: Record<string, Buffer | string>): void {
    for (const [relative, content] of Object.entries(files)) {
        const target = path.join(root, ...relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
}

function readTree(root: string, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            Object.assign(result, readTree(root, relative));
        } else {
            result[relative] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
        }
    }
    return result;
}

function downloadParameters(targetDirectory: string, patterns: string[] = []): ArtifactDownloadParameters {
    return {
        project: 'project',
        pipelineId: 1,
        targetDirectory,
        minimatchFilters: patterns,
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: false,
        parallelizationLimit: 8,
        retryDownloadCount: 4,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: true
    };
}

describe('publish and download pipeline artifacts against a fake service', function () {
    this.timeout(60000);
    let service: FakeService;
    let http: HttpClient;
    let source: string;
    const sourceFiles: Record<string, Buffer | string> = {
        'readme.txt': 'hello\n',
        'bin/app.dll': seeded('app', 3 * 1024 * 1024 + 17),
        'bin/zeros.bin': Buffer.alloc(900 * 1024),
        'docs/a.txt': 'doc a',
        'docs/b.txt': 'doc b',
        'docs/skip-me.txt': 'skipped by pattern',
        'empty.dat': '',
        'unicode-ü-文件.txt': 'unicode name'
    };

    beforeEach(async () => {
        logs.length = 0;
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => 'Bearer test', allowInsecureLoopback: true, userAgent: 'tests', logger });
        source = temporaryDirectory('src');
        writeTree(source, sourceFiles);
    });

    afterEach(async () => {
        http.close();
        await service.stop();
        fs.rmSync(source, { recursive: true, force: true });
    });

    async function publish(name = 'drop', properties?: Record<string, string>, from = source) {
        return publishPipelineArtifact({
            http, collectionUri: service.baseUrl + '/', projectId: 'p-1', buildId: 7, artifactName: name, jobId: 'job-1',
            sourcePath: from, properties, logger
        });
    }

    it('publishes content, associates the artifact and downloads it back', async () => {
        const result = await publish('drop', { 'user-note': 'hi' });
        assert.strictEqual(result.hashType, 'DEDUP1024K');
        assert.strictEqual(result.domainId, '0');
        assert.strictEqual(result.fileCount, 8);

        const [artifact] = service.artifacts.get('p-1/7')!;
        assert.strictEqual(artifact.name, 'drop');
        assert.strictEqual(artifact.source, 'job-1');
        assert.strictEqual(artifact.resource.type, 'PipelineArtifact');
        assert.strictEqual(artifact.resource.data, result.manifestId);
        const properties = artifact.resource.properties;
        assert.strictEqual(properties.RootId, result.rootId);
        assert.strictEqual(properties.HashType, 'DEDUP1024K');
        assert.strictEqual(properties.DomainId, '0');
        assert.strictEqual(properties['user-note'], 'hi');
        assert.strictEqual(properties.artifactsize, String(result.contentSize));
        const proofs = JSON.parse(properties.ProofNodes) as string[];
        assert.ok(Array.isArray(proofs) && proofs.length >= 2);
        assert.ok(service.nodes.has(result.rootId) && service.chunks.has(result.manifestId));

        const target = temporaryDirectory('dl');
        try {
            const client = new BuildClient(http, service.baseUrl + '/');
            const downloaded = await client.getArtifact('p-1', 7, 'drop');
            await new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), downloaded);

            const expected = readTree(source);
            delete expected['empty.dat'];
            const actual = readTree(target);
            assert.strictEqual(actual['empty.dat'], crypto.createHash('sha256').update('').digest('hex'));
            delete actual['empty.dat'];
            assert.deepStrictEqual(actual, expected);
            assert.strictEqual(fs.statSync(path.join(target, 'empty.dat')).size, 0);
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('publishes empty directories and names that start with two dots, leaves out .git, and restores them', async () => {
        const special = temporaryDirectory('special');
        try {
            writeTree(special, { '..twodots': 'dots', 'a/b.txt': 'b', '.git/HEAD': 'ref' });
            fs.mkdirSync(path.join(special, 'empty', 'nested'), { recursive: true });
            const result = await publish('special', undefined, special);
            assert.strictEqual(result.fileCount, 2);

            const target = temporaryDirectory('dl-special');
            try {
                const artifact = service.artifacts.get('p-1/7')!.find(candidate => candidate.name === 'special')!;
                await new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), artifact);
                assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['..twodots', 'a/b.txt']);
                assert.ok(fs.statSync(path.join(target, 'empty', 'nested')).isDirectory());
                assert.ok(!fs.existsSync(path.join(target, '.git')));
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(special, { recursive: true, force: true });
        }
    });

    it('publishes and downloads an artifact without any file when everything is ignored', async () => {
        const nothing = temporaryDirectory('nothing');
        try {
            writeTree(nothing, { '.artifactignore': '**/*\n', 'a.txt': 'a' });
            const result = await publish('nothing', undefined, nothing);
            assert.strictEqual(result.fileCount, 0);
            assert.strictEqual(result.contentSize, 0);

            const target = temporaryDirectory('dl-nothing');
            try {
                const artifact = service.artifacts.get('p-1/7')!.find(candidate => candidate.name === 'nothing')!;
                await new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), artifact);
                assert.deepStrictEqual(fs.readdirSync(target), []);
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(nothing, { recursive: true, force: true });
        }
    });

    it('does not repeat a download that fails because the manifest is invalid', async () => {
        await publish();
        const [artifact] = service.artifacts.get('p-1/7')!;
        // A manifest that is not valid is not going to be better the next time.
        const damaged = { ...artifact, resource: { ...artifact.resource, data: 'A'.repeat(64) + '01' } };
        const target = temporaryDirectory('dl-invalid');
        try {
            await assert.rejects(() => new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), damaged as typeof artifact));
            assert.ok(!logs.some(line => /Download attempt \d+ failed, retrying/.test(line)), 'no retry');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('does not upload content that already exists', async () => {
        await publish('first');
        const chunkPuts = service.countRequests('PUT', '/dedup/chunks');
        assert.ok(chunkPuts > 0);
        await publish('second');
        assert.strictEqual(service.countRequests('PUT', '/dedup/chunks'), chunkPuts);
        assert.strictEqual(service.artifacts.get('p-1/7')!.length, 2);
    });

    it('uses the 64K hash type when the organization asks for it', async () => {
        await service.stop();
        service = new FakeService({ chunkSize: 'Dedup64k' });
        await service.start();
        const result = await publish();
        assert.strictEqual(result.hashType, 'DEDUPNODEORCHUNK');
    });

    it('retries transient upload and download failures and refreshes expired blob URLs', async () => {
        let failedChunk = false;
        service.fault = request => {
            if (request.method === 'PUT' && request.path.endsWith('/dedup/chunks') && !failedChunk) {
                failedChunk = true;
                return 503;
            }
            return undefined;
        };
        await publish();
        assert.ok(failedChunk);

        let expiredUrl = false;
        service.fault = request => {
            if (request.method === 'GET' && request.path.startsWith('/storage/') && !expiredUrl) {
                expiredUrl = true;
                return 403;
            }
            return undefined;
        };
        const target = temporaryDirectory('retry');
        try {
            const [artifact] = service.artifacts.get('p-1/7')!;
            await new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), artifact);
            assert.ok(expiredUrl);
            assert.strictEqual(fs.readFileSync(path.join(target, 'readme.txt'), 'utf8'), 'hello\n');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('selects the items that any pattern accepts while downloading, and "!" accepts what the pattern does not match', async () => {
        await publish();
        const [artifact] = service.artifacts.get('p-1/7')!;
        const target = temporaryDirectory('patterns');
        const everything = temporaryDirectory('patterns-all');
        try {
            const provider = new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger });
            await provider.downloadSingleArtifact(downloadParameters(target, ['docs/**', 'readme.txt']), artifact);
            assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['docs/a.txt', 'docs/b.txt', 'docs/skip-me.txt', 'readme.txt']);

            // Like the agent plugin: "!docs/skip*" accepts every file that is not a docs/skip* file, so together with
            // "docs/**" all files are selected.
            await provider.downloadSingleArtifact(downloadParameters(everything, ['docs/**', '!docs/skip*', 'readme.txt']), artifact);
            assert.ok(Object.keys(readTree(everything)).includes('docs/skip-me.txt'));
            assert.ok(Object.keys(readTree(everything)).includes('readme.txt'));
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
            fs.rmSync(everything, { recursive: true, force: true });
        }
    });

    it('downloads several artifacts into sub folders and matches patterns with the artifact name', async () => {
        await publish('one');
        const second = temporaryDirectory('second');
        try {
            writeTree(second, { 'x.txt': 'x', 'sub/y.txt': 'y' });
            await publish('two', undefined, second);
            const artifacts = service.artifacts.get('p-1/7')!;
            const target = temporaryDirectory('multi');
            try {
                await new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger })
                    .downloadMultipleArtifacts(downloadParameters(target, ['two/**', 'one/readme.txt']), artifacts);
                assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['one/readme.txt', 'two/sub/y.txt', 'two/x.txt']);
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(second, { recursive: true, force: true });
        }
    });

    it('detects content that was tampered with in storage', async () => {
        await publish();
        const [artifact] = service.artifacts.get('p-1/7')!;
        const victim = [...service.chunks.keys()].find(id => service.chunks.get(id)!.length > 100000)!;
        const tampered = Buffer.from(service.chunks.get(victim)!);
        tampered[10] ^= 0xFF;
        service.chunks.set(victim, tampered);

        const target = temporaryDirectory('tamper');
        try {
            await assert.rejects(
                () => new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadSingleArtifact(downloadParameters(target), artifact),
                (error: Error) => error instanceof IntegrityError || /integrity|identifier|neither/i.test(error.message)
            );
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('fails when a file changes while it is being uploaded', async () => {
        const volatile = path.join(source, 'bin', 'app.dll');
        let modified = false;
        service.fault = request => {
            if (request.method === 'PUT' && request.path.endsWith('/dedup/chunks') && !modified) {
                modified = true;
                const data = fs.readFileSync(volatile);
                data[5] ^= 1;
                fs.writeFileSync(volatile, data);
            }
            return undefined;
        };
        await assert.rejects(() => publish(), /changed while it was being (uploaded|read)/);
    });
});
