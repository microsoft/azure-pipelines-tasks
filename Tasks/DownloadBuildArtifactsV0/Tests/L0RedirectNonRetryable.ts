import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('buildType', 'current');
tr.setInput('downloadType', 'single');
tr.setInput('artifactName', 'drop');
tr.setInput('downloadPath', path.join(__dirname, 'redirect-nonretry-out'));
tr.setInput('cleanDestinationFolder', 'false');
tr.setInput('checkDownloadedFiles', 'false');
tr.setInput('extractTars', 'false');
tr.setInput('retryRedirectDownloadCount', '2');
tr.setInput('retryDownloadCount', '2');

process.env['SYSTEM_TEAMPROJECTID'] = 'project-id';
process.env['BUILD_BUILDID'] = '42';
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://example.org/collection/';
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'token';
process.env['SYSTEM_PREFERREDIRECTGETCONTAINERITEM'] = 'true';

let redirectCallCount = 0;
let classicCallCount = 0;

class FakeBuildApi {
    getArtifact(): Promise<any> {
        return Promise.resolve({ name: 'drop', resource: { type: 'Container', data: '#/1/drop' } });
    }
}

class FakeWebApi {
    constructor(url: string, handler: any) { }
    getBuildApi(): Promise<any> {
        return Promise.resolve(new FakeBuildApi());
    }
}

tr.registerMock('azure-devops-node-api/WebApi', {
    WebApi: FakeWebApi,
    getHandlerFromToken: () => ({})
});

tr.registerMock('./DownloadHandlers/DownloadHandlerContainer', {
    DownloadHandlerContainer: class {
        config: any;
        constructor(config: any) {
            this.config = config;
        }
        downloadResources(): Promise<any> {
            if (this.config.preferRedirect) {
                redirectCallCount++;
            } else {
                classicCallCount++;
            }
            const err: any = new Error('simulated path-escape rejection');
            err.nonRetryable = true;
            return Promise.reject(err);
        }
    }
});

process.on('exit', () => {
    console.log(`REDIRECT_CALLS=${redirectCallCount}`);
    console.log(`CLASSIC_CALLS=${classicCallCount}`);
});

tr.run();
