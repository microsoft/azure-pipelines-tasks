import assert = require('assert');
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
let manifestUploaded = false;

tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
tr.setAnswers(answers.defaultAnswers);
tr.registerMockExport('getVariable', (name: string) => variables[name]);
tr.registerMockExport('getEndpointAuthorizationParameter', () => 'token');

tr.registerMock('azure-devops-node-api', {
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
});

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
            return successfulResponse();
        }

        public async put(url: string) {
            if (url.includes('manifest.json')) {
                manifestUploaded = true;
            }
            return successfulResponse();
        }

        public async post(url: string) {
            assert(manifestUploaded, 'raw coverage processing must be queued after the manifest upload');
            assert(url.includes('/_apis/testresults/codecoverage/rawcoveragebundle/capabilities?'));
            return successfulResponse();
        }

        public dispose() {
        }
    }
});

tr.registerMock('fs', {
    statSync: () => ({ size: 1 }),
    createReadStream: () => stream.Readable.from(Buffer.from('x')),
    readFileSync: () => JSON.stringify({
        version: { Major: 2, Minor: 281, Patch: 0 }
    }),
    mkdirSync: (reportDirectory: string) => {
        if (!manifestUploaded) {
            throw new Error('additive mode must finish the raw manifest before ReportGenerator starts');
        }
        answers.defaultAnswers.exec[
            `${coveragePublisherPath} /user/admin/summary.xml --reportDirectory ${reportDirectory}`
        ] = {
            code: 0,
            stdout: 'REPORT_GENERATOR_EXECUTED'
        };
    }
});

tr.run();

function successfulResponse() {
    return {
        message: { statusCode: 201 },
        readBody: async () => ''
    };
}
