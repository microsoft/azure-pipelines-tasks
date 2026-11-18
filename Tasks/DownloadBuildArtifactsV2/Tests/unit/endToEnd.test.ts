import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildClient } from '../../DownloadEngine/build/buildClient';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { IntegrityError } from '../../DownloadEngine/errors';
import { PipelineArtifactProvider } from '../../DownloadEngine/providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters } from '../../DownloadEngine/providers/types';
import { Logger } from '../../DownloadEngine/util/logger';
import { addFolderArtifact } from './artifactWriter';
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
    return fs.mkdtempSync(path.join(os.tmpdir(), `dba-${name}-`));
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

describe('artifact downloads against a fake service', function () {
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

    function addArtifact(name = 'drop', from = source) {
        return addFolderArtifact(service, { projectId: 'p-1', buildId: 7, artifactName: name, sourcePath: from });
    }

    function provider(): PipelineArtifactProvider {
        return new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger });
    }

    it('downloads the content of an artifact', async () => {
        const added = addArtifact();
        assert.strictEqual(added.fileCount, 8);

        const target = temporaryDirectory('dl');
        try {
            const downloaded = await new BuildClient(http, service.baseUrl + '/').getArtifact('p-1', 7, 'drop');
            assert.strictEqual(downloaded.resource.type, 'PipelineArtifact');
            assert.strictEqual(downloaded.resource.data, added.manifestId);
            await provider().downloadSingleArtifact(downloadParameters(target), downloaded);

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

    it('restores empty directories and names that start with two dots', async () => {
        const special = temporaryDirectory('special');
        try {
            writeTree(special, { '..twodots': 'dots', 'a/b.txt': 'b' });
            fs.mkdirSync(path.join(special, 'empty', 'nested'), { recursive: true });
            const added = addArtifact('special', special);
            assert.strictEqual(added.fileCount, 2);

            const target = temporaryDirectory('dl-special');
            try {
                const artifact = service.artifacts.get('p-1/7')!.find(candidate => candidate.name === 'special')!;
                await provider().downloadSingleArtifact(downloadParameters(target), artifact);
                assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['..twodots', 'a/b.txt']);
                assert.ok(fs.statSync(path.join(target, 'empty', 'nested')).isDirectory());
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(special, { recursive: true, force: true });
        }
    });

    it('downloads an artifact without any file', async () => {
        const nothing = temporaryDirectory('nothing');
        try {
            const added = addArtifact('nothing', nothing);
            assert.strictEqual(added.fileCount, 0);
            assert.strictEqual(added.contentSize, 0);

            const target = temporaryDirectory('dl-nothing');
            try {
                const artifact = service.artifacts.get('p-1/7')!.find(candidate => candidate.name === 'nothing')!;
                await provider().downloadSingleArtifact(downloadParameters(target), artifact);
                assert.deepStrictEqual(fs.readdirSync(target), []);
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(nothing, { recursive: true, force: true });
        }
    });

    it('does not repeat a download that fails because the manifest is invalid', async () => {
        addArtifact();
        const [artifact] = service.artifacts.get('p-1/7')!;
        // A manifest that is not valid is not going to be better the next time.
        const damaged = { ...artifact, resource: { ...artifact.resource, data: 'A'.repeat(64) + '01' } };
        const target = temporaryDirectory('dl-invalid');
        try {
            await assert.rejects(() => provider().downloadSingleArtifact(downloadParameters(target), damaged as typeof artifact));
            assert.ok(!logs.some(line => /Download attempt \d+ failed, retrying/.test(line)), 'no retry');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('retries transient download failures and refreshes expired blob URLs', async () => {
        addArtifact();

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
            await provider().downloadSingleArtifact(downloadParameters(target), artifact);
            assert.ok(expiredUrl);
            assert.strictEqual(fs.readFileSync(path.join(target, 'readme.txt'), 'utf8'), 'hello\n');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('selects the items that any pattern accepts while downloading, and "!" accepts what the pattern does not match', async () => {
        addArtifact();
        const [artifact] = service.artifacts.get('p-1/7')!;
        const target = temporaryDirectory('patterns');
        const everything = temporaryDirectory('patterns-all');
        try {
            await provider().downloadSingleArtifact(downloadParameters(target, ['docs/**', 'readme.txt']), artifact);
            assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['docs/a.txt', 'docs/b.txt', 'docs/skip-me.txt', 'readme.txt']);

            // Like the agent plugin: "!docs/skip*" accepts every file that is not a docs/skip* file, so together with
            // "docs/**" all files are selected.
            await provider().downloadSingleArtifact(downloadParameters(everything, ['docs/**', '!docs/skip*', 'readme.txt']), artifact);
            assert.ok(Object.keys(readTree(everything)).includes('docs/skip-me.txt'));
            assert.ok(Object.keys(readTree(everything)).includes('readme.txt'));
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
            fs.rmSync(everything, { recursive: true, force: true });
        }
    });

    it('downloads several artifacts into sub folders and matches patterns with the artifact name', async () => {
        addArtifact('one');
        const second = temporaryDirectory('second');
        try {
            writeTree(second, { 'x.txt': 'x', 'sub/y.txt': 'y' });
            addArtifact('two', second);
            const artifacts = service.artifacts.get('p-1/7')!;
            const target = temporaryDirectory('multi');
            try {
                await provider().downloadMultipleArtifacts(downloadParameters(target, ['two/**', 'one/readme.txt']), artifacts);
                assert.deepStrictEqual(Object.keys(readTree(target)).sort(), ['one/readme.txt', 'two/sub/y.txt', 'two/x.txt']);
            } finally {
                fs.rmSync(target, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(second, { recursive: true, force: true });
        }
    });

    it('creates the target folder, but the folder of an artifact only when it has something to download', async () => {
        addArtifact('one');
        const nothing = temporaryDirectory('nothing');
        try {
            addArtifact('nothing', nothing);
            const artifacts = service.artifacts.get('p-1/7')!;
            const parent = temporaryDirectory('multi-empty');
            const target = path.join(parent, 'not', 'there', 'yet');
            try {
                await provider().downloadMultipleArtifacts(downloadParameters(target), artifacts);
                assert.ok(fs.existsSync(path.join(target, 'one', 'readme.txt')));
                assert.ok(!fs.existsSync(path.join(target, 'nothing')), 'an artifact without entries must not leave a folder');

                const only = path.join(parent, 'only-empty');
                await provider().downloadMultipleArtifacts(downloadParameters(only), artifacts.filter(artifact => artifact.name === 'nothing'));
                assert.ok(fs.statSync(only).isDirectory(), 'the target folder itself is always created');
                assert.deepStrictEqual(fs.readdirSync(only), []);
            } finally {
                fs.rmSync(parent, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(nothing, { recursive: true, force: true });
        }
    });

    it('detects content that was tampered with in storage', async () => {
        addArtifact();
        const [artifact] = service.artifacts.get('p-1/7')!;
        const victim = [...service.chunks.keys()].find(id => service.chunks.get(id)!.length > 100000)!;
        const tampered = Buffer.from(service.chunks.get(victim)!);
        tampered[10] ^= 0xFF;
        service.chunks.set(victim, tampered);

        const target = temporaryDirectory('tamper');
        try {
            await assert.rejects(
                () => provider().downloadSingleArtifact(downloadParameters(target), artifact),
                (error: Error) => error instanceof IntegrityError || /integrity|identifier|neither/i.test(error.message)
            );
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });
});
