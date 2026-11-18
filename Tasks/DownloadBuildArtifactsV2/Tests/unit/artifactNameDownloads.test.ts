import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildClient } from '../../DownloadEngine/build/buildClient';
import { downloadArtifactsFromBuild } from '../../DownloadEngine/build/downloadArtifacts';
import { ArtifactError } from '../../DownloadEngine/errors';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { FileShareProvider } from '../../DownloadEngine/providers/fileShareProvider';
import { PipelineArtifactProvider } from '../../DownloadEngine/providers/pipelineArtifactProvider';
import { ArtifactDownloadParameters } from '../../DownloadEngine/providers/types';
import { UnsafePathError } from '../../DownloadEngine/util/paths';
import { FakeService } from './fakeService';

const logger = { debug: () => undefined, info: () => undefined, warning: () => undefined, error: () => undefined };

function listFiles(root: string, from = root, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const full = path.join(from, entry.name);
        if (entry.isDirectory()) {
            listFiles(root, full, found);
        } else {
            found.push(path.relative(root, full).split(path.sep).join('/'));
        }
    }
    return found.sort();
}

function parameters(targetDirectory: string, artifactName: string | undefined, patterns: string[] = ['**']): ArtifactDownloadParameters {
    return {
        project: 'p-1',
        pipelineId: 7,
        artifactName,
        targetDirectory,
        minimatchFilters: patterns,
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: true,
        parallelizationLimit: 4,
        retryDownloadCount: 1,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: false
    };
}

describe('artifact names in a download', function () {
    this.timeout(60000);

    let service: FakeService;
    let http: HttpClient;
    let root: string;
    let share: string;
    let target: string;

    // root/share/inner/{drop/a.txt, b.txt}, root/share/parent.txt, root/share/sibling/c.txt, and the target root/out/target.
    beforeEach(async () => {
        service = new FakeService();
        await service.start();
        http = new HttpClient({ authorization: () => 'Bearer x', allowInsecureLoopback: true, userAgent: 'tests' });
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-names-'));
        share = path.join(root, 'share');
        fs.mkdirSync(path.join(share, 'inner', 'drop'), { recursive: true });
        fs.mkdirSync(path.join(share, 'sibling'), { recursive: true });
        fs.writeFileSync(path.join(share, 'inner', 'drop', 'a.txt'), 'a');
        fs.writeFileSync(path.join(share, 'inner', 'b.txt'), 'b');
        fs.writeFileSync(path.join(share, 'parent.txt'), 'parent');
        fs.writeFileSync(path.join(share, 'sibling', 'c.txt'), 'c');
        target = path.join(root, 'out', 'target');
        fs.mkdirSync(target, { recursive: true });
    });

    afterEach(async () => {
        http.close();
        await service.stop();
        fs.rmSync(root, { recursive: true, force: true });
    });

    const providers = () => ({
        pipelineArtifact: new PipelineArtifactProvider({ http, collectionUri: service.baseUrl + '/', logger }),
        fileShare: new FileShareProvider({ http, collectionUri: service.baseUrl + '/', logger })
    });

    const shareArtifact = (name: string, data: string) => ({ id: Math.floor(Math.random() * 1e6), name, resource: { type: 'FilePath', data } });
    const outsideTheTarget = () => listFiles(root).filter(file => !file.startsWith('out/target/') && !file.startsWith('share/'));

    it('skips the artifacts of the build with an invalid name, reports each of them and downloads the others', async () => {
        service.artifacts.set('p-1/7', [
            shareArtifact('..', path.join(share, 'inner')),
            shareArtifact('drop', path.join(share, 'inner')),
            shareArtifact('../sibling', path.join(share, 'inner')),
            shareArtifact('...', path.join(share, 'inner')),
            shareArtifact('', path.join(share, 'inner')),
            shareArtifact('a:b', path.join(share, 'inner'))
        ]);
        const invalid: Array<string | undefined> = [];
        const variables = new Map<string, string>();

        await downloadArtifactsFromBuild({
            buildClient: new BuildClient(http, service.baseUrl + '/'),
            // A pattern that matches paths which start with "..": without the check the artifact ".." would copy its files out of the target.
            params: parameters(target, '', ['**', '../*', '../sibling/*']),
            providers: providers(),
            onInvalidArtifactName: name => invalid.push(name),
            setVariable: (name, value) => variables.set(name, value)
        });

        assert.deepStrictEqual(invalid, ['..', '../sibling', '...', '', 'a:b']);
        assert.deepStrictEqual(listFiles(target), ['drop/a.txt']);
        assert.deepStrictEqual(outsideTheTarget(), []);
        assert.strictEqual(variables.get('DownloadPipelineArtifactResourceTypes'), 'filepath');
    });

    it('sets the resource types to nothing when every name is invalid', async () => {
        service.artifacts.set('p-1/7', [shareArtifact('..', share)]);
        const variables = new Map<string, string>();
        await downloadArtifactsFromBuild({
            buildClient: new BuildClient(http, service.baseUrl + '/'),
            params: parameters(target, ''),
            providers: providers(),
            onInvalidArtifactName: () => undefined,
            setVariable: (name, value) => variables.set(name, value)
        });
        assert.strictEqual(variables.get('DownloadPipelineArtifactResourceTypes'), '');
        assert.deepStrictEqual(listFiles(root).filter(file => file.startsWith('out/')), []);
    });

    it('stops before anything is written when nobody handles an invalid name', async () => {
        service.artifacts.set('p-1/7', [shareArtifact('drop', path.join(share, 'inner')), shareArtifact('..', path.join(share, 'inner'))]);
        await assert.rejects(
            () => downloadArtifactsFromBuild({ buildClient: new BuildClient(http, service.baseUrl + '/'), params: parameters(target, '', ['**', '../*']), providers: providers() }),
            (error: Error) => error instanceof ArtifactError && /Artifact name is not valid: \.\./.test(error.message));
        assert.deepStrictEqual(listFiles(root).filter(file => !file.startsWith('share/')), []);
    });

    it('refuses an invalid name of a single download before it asks the service anything', async () => {
        for (const name of ['..', ' . . ', '../outside', 'a/b']) {
            const before = service.requests.length;
            await assert.rejects(
                () => downloadArtifactsFromBuild({ buildClient: new BuildClient(http, service.baseUrl + '/'), params: parameters(target, name), providers: providers(), downloadAll: false }),
                (error: Error) => error instanceof ArtifactError && error.message.startsWith('Artifact name is not valid:'));
            assert.strictEqual(service.requests.length, before, `no request for "${name}"`);
        }
    });

    it('also refuses a name in the answer of the service that cannot be a folder name, although the name that was asked for can', async () => {
        const answers = [shareArtifact('a/b', path.join(share, 'inner')), shareArtifact('..', path.join(share, 'inner'))];
        for (const answer of answers) {
            const buildClient = { getArtifact: async () => answer } as unknown as BuildClient;
            await assert.rejects(
                () => downloadArtifactsFromBuild({ buildClient, params: parameters(target, 'drop', ['**', '../*']), providers: providers() }),
                (error: Error) => error instanceof ArtifactError && error.message.startsWith(`Artifact name is not valid: ${answer.name}.`));
        }
        assert.deepStrictEqual(listFiles(root).filter(file => file.startsWith('out/')), []);
    });

    it('does not let the file share provider copy out of the destination, whatever the patterns say', async () => {
        for (const name of ['..', '../sibling', 'x/../..']) {
            await assert.rejects(
                () => new FileShareProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadMultipleArtifacts(
                    parameters(target, name, ['**', '../*', '../sibling/*']), [shareArtifact(name, path.join(share, 'inner'))]),
                UnsafePathError,
                `the name "${name}"`);
        }
        assert.deepStrictEqual(outsideTheTarget(), []);
        assert.deepStrictEqual(listFiles(target), []);
    });

    it('still copies a file share artifact with an ordinary name, also when the name has a folder in it', async () => {
        fs.mkdirSync(path.join(share, 'inner', 'nested', 'deeper'), { recursive: true });
        fs.writeFileSync(path.join(share, 'inner', 'nested', 'deeper', 'd.txt'), 'd');
        await new FileShareProvider({ http, collectionUri: service.baseUrl + '/', logger }).downloadMultipleArtifacts(
            parameters(target, 'drop'), [shareArtifact('drop', path.join(share, 'inner')), shareArtifact('nested/deeper', path.join(share, 'inner'))]);
        assert.deepStrictEqual(listFiles(target), ['drop/a.txt', 'nested/deeper/d.txt']);
    });
});
