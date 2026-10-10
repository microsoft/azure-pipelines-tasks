import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildClient } from '../src/build/buildClient';
import { downloadArtifactsFromBuild } from '../src/build/downloadArtifacts';
import { HttpClient } from '../src/http/httpClient';
import { PipelineArtifactProvider } from '../src/providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters } from '../src/providers/types';
import { publishPipelineArtifact } from '../src/publishing/publishPipelineArtifact';
import { FakeService } from './fakeService';

function temporaryDirectory(name: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `pac-${name}-`));
}

function downloadParameters(targetDirectory: string, artifactName?: string): ArtifactDownloadParameters {
    return {
        project: 'p-1',
        pipelineId: 7,
        artifactName,
        targetDirectory,
        minimatchFilters: ['**'],
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: false,
        parallelizationLimit: 8,
        retryDownloadCount: 4,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: true
    };
}

describe('download flow helper', function () {
    this.timeout(60000);

    let service: FakeService;
    let http: HttpClient;
    let source: string;

    beforeEach(async () => {
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => '******', allowInsecureLoopback: true, userAgent: 'tests' });
        source = temporaryDirectory('flow-src');
        fs.writeFileSync(path.join(source, 'readme.txt'), 'hello\n');
        fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(source, 'docs', 'a.txt'), 'a');
    });

    afterEach(async () => {
        http.close();
        await service.stop();
        fs.rmSync(source, { recursive: true, force: true });
    });

    it('downloads a specific pipeline artifact and sets DownloadPipelineArtifactResourceTypes', async () => {
        await publishPipelineArtifact({
            http,
            collectionUri: service.baseUrl + '/',
            projectId: 'p-1',
            buildId: 7,
            artifactName: 'drop',
            jobId: 'job-1',
            sourcePath: source,
            logger: { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined }
        });

        const target = temporaryDirectory('flow-target');
        const variables = new Map<string, string>();
        try {
            await downloadArtifactsFromBuild({
                buildClient: new BuildClient(http, service.baseUrl + '/'),
                params: downloadParameters(target, 'drop'),
                providers: {
                    pipelineArtifact: new PipelineArtifactProvider({
                        http,
                        collectionUri: service.baseUrl + '/',
                        logger: { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined }
                    })
                },
                setVariable: (name, value) => variables.set(name, value)
            });

            assert.strictEqual(fs.readFileSync(path.join(target, 'readme.txt'), 'utf8'), 'hello\n');
            assert.strictEqual(fs.readFileSync(path.join(target, 'docs', 'a.txt'), 'utf8'), 'a');
            assert.strictEqual(variables.get('DownloadPipelineArtifactResourceTypes'), 'PipelineArtifact');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });

    it('downloads all pipeline artifacts into subdirectories when the artifact name is empty', async () => {
        await publishPipelineArtifact({
            http,
            collectionUri: service.baseUrl + '/',
            projectId: 'p-1',
            buildId: 7,
            artifactName: 'drop',
            jobId: 'job-1',
            sourcePath: source,
            logger: { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined }
        });

        const second = temporaryDirectory('flow-second');
        fs.writeFileSync(path.join(second, 'b.txt'), 'b');
        await publishPipelineArtifact({
            http,
            collectionUri: service.baseUrl + '/',
            projectId: 'p-1',
            buildId: 7,
            artifactName: 'other',
            jobId: 'job-1',
            sourcePath: second,
            logger: { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined }
        });

        const target = temporaryDirectory('flow-multi');
        const variables = new Map<string, string>();
        try {
            await downloadArtifactsFromBuild({
                buildClient: new BuildClient(http, service.baseUrl + '/'),
                params: downloadParameters(target, ''),
                providers: {
                    pipelineArtifact: new PipelineArtifactProvider({
                        http,
                        collectionUri: service.baseUrl + '/',
                        logger: { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined }
                    })
                },
                setVariable: (name, value) => variables.set(name, value)
            });

            assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'readme.txt'), 'utf8'), 'hello\n');
            assert.strictEqual(fs.readFileSync(path.join(target, 'other', 'b.txt'), 'utf8'), 'b');
            assert.strictEqual(variables.get('DownloadPipelineArtifactResourceTypes'), 'PipelineArtifact');
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
            fs.rmSync(second, { recursive: true, force: true });
        }
    });

    it('downloads every artifact of the build when asked to, even though a name is given, and ignores artifacts of other types', async () => {
        const logger = { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined };
        await publishPipelineArtifact({ http, collectionUri: service.baseUrl + '/', projectId: 'p-1', buildId: 7, artifactName: 'drop', jobId: 'job-1', sourcePath: source, logger });
        service.artifacts.get('p-1/7')!.push({ id: 99, name: 'legacy', resource: { type: 'SomethingElse', data: 'x' } });

        const target = temporaryDirectory('flow-all');
        const variables = new Map<string, string>();
        try {
            const options = {
                buildClient: new BuildClient(http, service.baseUrl + '/'),
                providers: { pipelineArtifact: new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }) },
                setVariable: (name: string, value: string) => variables.set(name, value)
            };
            await downloadArtifactsFromBuild({ ...options, params: downloadParameters(target, 'drop'), downloadAll: true });
            assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'readme.txt'), 'utf8'), 'hello\n');
            assert.ok(!fs.existsSync(path.join(target, 'legacy')));
            assert.strictEqual(variables.get('DownloadPipelineArtifactResourceTypes'), 'PipelineArtifact');

            const single = temporaryDirectory('flow-single');
            try {
                await downloadArtifactsFromBuild({ ...options, params: downloadParameters(single, 'drop'), downloadAll: false });
                assert.strictEqual(fs.readFileSync(path.join(single, 'readme.txt'), 'utf8'), 'hello\n');
            } finally {
                fs.rmSync(single, { recursive: true, force: true });
            }
        } finally {
            fs.rmSync(target, { recursive: true, force: true });
        }
    });
});
