import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);
const variables: { [key: string]: string } = {
    'System.DefaultWorkingDirectory': '/someDir',
    'System.TeamFoundationCollectionUri': 'https://dev.azure.com/example/',
    'System.TeamProjectId': '00000000-0000-0000-0000-000000000001',
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
tr.setVariableName('System.TeamFoundationCollectionUri', 'https://dev.azure.com/example/');
tr.setVariableName('System.TeamProjectId', '00000000-0000-0000-0000-000000000001');
tr.setVariableName('Build.BuildId', '42');
tr.setVariableName('Agent.TempDirectory', '/someDir');
tr.registerMockExport('getVariable', (name: string) => variables[name]);
tr.registerMockExport('getEndpointAuthorizationParameter', () => 'token');

tr.registerMock('typed-rest-client/HttpClient', {
    HttpClient: class {
        public async get() {
            return {
                message: {
                    statusCode: 404
                },
                readBody: async () => ''
            };
        }

        public dispose() {
        }
    }
});
tr.registerMock('fs', {
    mkdirSync: (reportDirectory: string) => {
        answers.defaultAnswers.exec[
            `${coveragePublisherPath} /user/admin/summary.xml --reportDirectory ${reportDirectory}`
        ] = {
            code: 0,
            stdout: 'REPORT_GENERATOR_EXECUTED'
        };
    },
    readFileSync: () => JSON.stringify({
        version: { Major: 2, Minor: 281, Patch: 0 }
    })
});

tr.run();
