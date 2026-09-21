import path = require('path');
import stream = require('stream');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr = new TaskMockRunner(taskPath);
const variables: { [key: string]: string } = {
    'System.DefaultWorkingDirectory': '/someDir',
    'System.TeamFoundationCollectionUri': 'https://dev.azure.com/example/',
    'System.TeamProjectId': '00000000-0000-0000-0000-000000000001',
    'System.TaskInstanceId': '00000000-0000-0000-0000-000000000002',
    'Build.BuildId': '42',
    'Agent.TempDirectory': '/someDir'
};
const coveragePublisherPath = path.join(
    __dirname,
    '..',
    'node_modules',
    'azure-pipelines-tasks-coveragepublisher',
    'CoveragePublisher',
    'CoveragePublisher.Console.exe');
answers.defaultAnswers.exec = {};

tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
tr.setAnswers(answers.defaultAnswers);
tr.registerMockExport('getVariable', (name: string) => variables[name]);
tr.registerMockExport('getEndpointAuthorizationParameter', () => 'token');

tr.registerMock('azure-devops-node-api', createTestResultsApiMock());
tr.registerMock('typed-rest-client/HttpClient', {
    HttpClient: class {
        public async get() {
            return {
                message: { statusCode: 200 },
                readBody: async () => JSON.stringify({
                    contractVersion: '1.0',
                    acceptedSchemaMajorVersions: [1],
                    supportedModes: ['shadow']
                })
            };
        }

        public async sendStream() {
            return {
                message: { statusCode: 500 },
                readBody: async () => 'upload failed'
            };
        }

        public async put(url: string) {
            if (url.includes('manifest.json')) {
                throw new Error('manifest must not upload after a blob failure');
            }
            return successfulResponse();
        }

        public dispose() {
        }
    }
});
tr.registerMock('fs', createFileSystemMock());

tr.run();

function createTestResultsApiMock() {
    return {
        getHandlerFromToken: () => ({}),
        getPersonalAccessTokenHandler: () => ({}),
        WebApi: class {
            public async getTestResultsApi() {
                return {
                    testLogStoreEndpointDetailsForBuild: async () => ({
                        endpointSASUri: 'https://account.blob.core.windows.net/container?sig=secret'
                    })
                };
            }
        }
    };
}

function createFileSystemMock() {
    return {
        statSync: () => ({ size: 1 }),
        createReadStream: () => stream.Readable.from(Buffer.from('x')),
        readFileSync: () => JSON.stringify({
            version: { Major: 2, Minor: 281, Patch: 0 }
        }),
        mkdirSync: (reportDirectory: string) => {
            answers.defaultAnswers.exec[
                `${coveragePublisherPath} /user/admin/summary.xml --reportDirectory ${reportDirectory}`
            ] = {
                code: 0,
                stdout: 'REPORT_GENERATOR_EXECUTED'
            };
        }
    };
}

function successfulResponse() {
    return {
        message: { statusCode: 201 },
        readBody: async () => ''
    };
}
