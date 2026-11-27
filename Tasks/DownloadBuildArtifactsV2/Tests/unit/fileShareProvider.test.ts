import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileShareProvider } from '../../DownloadEngine/providers/fileShareProvider';
import { ArtifactDownloadParameters, ProviderContext } from '../../DownloadEngine/providers/types';
import { HttpClient } from '../../DownloadEngine/http/httpClient';
import { consoleLogger } from '../../DownloadEngine/util/logger';

const workRoot = path.join(os.tmpdir(), `dba-share-${process.pid}`);

function workDir(name: string): string {
    const root = path.join(workRoot, name);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    return root;
}

function params(targetDirectory: string, patterns: string[] = ['**']): ArtifactDownloadParameters {
    return {
        project: 'project',
        pipelineId: 1,
        targetDirectory,
        minimatchFilters: patterns,
        minimatchFilterWithArtifactName: true,
        includeArtifactNameInPath: true,
        parallelizationLimit: 1,
        retryDownloadCount: 1,
        checkDownloadedFiles: false,
        extractTars: false,
        appendArtifactNameToTargetPath: false
    };
}

describe('FileShareProvider', function () {
    this.timeout(30000);
    let http: HttpClient;
    let context: ProviderContext;

    beforeEach(() => {
        http = new HttpClient({ allowInsecureLoopback: true, logger: consoleLogger });
        context = { http, collectionUri: 'https://example.invalid/', logger: consoleLogger };
    });

    afterEach(() => {
        http.close();
        fs.rmSync(workRoot, { recursive: true, force: true });
    });

    it('copies filtered files from the file share artifact path', async () => {
        const share = workDir('share');
        const source = path.join(share, 'drop');
        fs.mkdirSync(path.join(source, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(source, 'docs', 'keep.txt'), 'keep');
        fs.writeFileSync(path.join(source, 'docs', 'skip.log'), 'skip');
        fs.writeFileSync(path.join(source, 'root.txt'), 'root');

        const target = workDir('share-target');
        await new FileShareProvider(context).downloadSingleArtifact(params(target, ['drop/**', '!drop/**/*.log']), {
            name: 'drop',
            resource: { type: 'FilePath', data: share }
        });

        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'docs', 'keep.txt'), 'utf8'), 'keep');
        assert.strictEqual(fs.readFileSync(path.join(target, 'drop', 'root.txt'), 'utf8'), 'root');
        assert.ok(!fs.existsSync(path.join(target, 'drop', 'docs', 'skip.log')));
    });

    it('does not follow a symbolic link that it finds in the share, to a file or to a folder', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        const share = workDir('links-share');
        const source = path.join(share, 'drop');
        const outside = workDir('links-outside');
        fs.mkdirSync(source, { recursive: true });
        fs.writeFileSync(path.join(source, 'real.txt'), 'real');
        fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
        fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(source, 'file-link'));
        fs.symlinkSync(outside, path.join(source, 'folder-link'));
        fs.symlinkSync(path.join(outside, 'missing'), path.join(source, 'broken-link'));

        const target = workDir('links-target');
        await new FileShareProvider(context).downloadSingleArtifact(params(target), { name: 'drop', resource: { type: 'FilePath', data: share } });

        assert.deepStrictEqual(fs.readdirSync(path.join(target, 'drop')), ['real.txt']);
    });
});
