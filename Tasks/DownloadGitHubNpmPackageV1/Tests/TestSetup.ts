import * as fs from 'fs';
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'npm.js');
const tr = new tmrm.TaskMockRunner(taskPath);

const npmrcPath = process.env['TEST_NPMRC_PATH']!;
const npmShouldFail = process.env['TEST_NPM_SHOULD_FAIL'] === 'true';

tr.setInput('externalEndpoints', 'github');
tr.setInput('packageName', process.env['TEST_PACKAGE_NAME'] || 'owner/pkg');
tr.setInput('version', '1.0.0');

process.env['AGENT_BUILDDIRECTORY'] = path.dirname(npmrcPath);

tr.registerMockExport('getEndpointAuthorizationScheme', () => 'PersonalAccessToken');
tr.registerMockExport('getEndpointAuthorization', () => ({
    scheme: 'PersonalAccessToken',
    parameters: { accessToken: 'fake-marker-token' }
}));
// Use the real file system so tests can verify the credential file is actually removed.
tr.registerMockExport('exist', (p: string) => fs.existsSync(p));
tr.registerMockExport('rmRF', (p: string) => fs.rmSync(p, { recursive: true, force: true }));

tr.registerMock('typed-rest-client/HttpClient', {
    HttpClient: class {
        async get() {
            return { readBody: async () => JSON.stringify({ login: 'owner' }) };
        }
    }
});

tr.registerMock('azure-pipelines-tasks-packaging-common/npm/npmutil', {
    getTempNpmrcPath: () => npmrcPath,
    appendToNpmrc: (file: string, data: string) => fs.appendFileSync(file, data)
});

tr.registerMock('./npmtoolrunner', {
    NpmToolRunner: class {
        line() { }
        execSync() {
            if (fs.existsSync(npmrcPath) && fs.readFileSync(npmrcPath, 'utf8').includes('fake-marker-token')) {
                console.log('TEST_NPMRC_WRITTEN');
            }
            if (npmShouldFail) {
                throw new Error('npm failed');
            }
            return { code: 0, stdout: '', stderr: '' };
        }
    }
});

tr.run();
