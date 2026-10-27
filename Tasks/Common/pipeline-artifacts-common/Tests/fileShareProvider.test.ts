import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { FileShareProvider } from '../src/providers/fileShareProvider';
import { ArtifactDownloadParameters, ProviderContext } from '../src/providers/types';
import { HttpClient } from '../src/http/httpClient';
import { consoleLogger } from '../src/util/logger';

function workDir(name: string): string {
    const root = path.join(process.cwd(), '_testwork', name);
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
        fs.rmSync(path.join(process.cwd(), '_testwork'), { recursive: true, force: true });
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
});
