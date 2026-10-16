import tmrm = require('azure-pipelines-task-lib/mock-run');
import os = require('os');
import path = require('path');
import { parseDotNetBoolean, parseDotNetInt32, requireProjectGuid } from 'azure-pipelines-tasks-pipeline-artifacts-common';

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('source', 'current');
tr.setInput('artifact', 'drop');
tr.setInput('path', path.join(os.tmpdir(), 'dpa-l0-current-run'));
process.env['SYSTEM_SERVERTYPE'] = 'Hosted';
process.env['SYSTEM_TEAMPROJECTID'] = '11111111-2222-3333-4444-555555555555';
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://dev.azure.com/org/';
process.env['BUILD_BUILDID'] = '42';
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = 'test-token';

function provider(name: string): any {
    return class {
        constructor(context: any) {
            if (!context.http) {
                throw new Error(`${name} was created without an HTTP client`);
            }
        }
    };
}

tr.registerMock('azure-pipelines-tasks-pipeline-artifacts-common', {
    parseDotNetBoolean,
    parseDotNetInt32,
    requireProjectGuid,
    getResultFilter: () => 2,
    HttpClient: class { close() { } },
    BuildClient: class { },
    PipelineArtifactProvider: provider('PipelineArtifactProvider'),
    FileContainerProvider: provider('FileContainerProvider'),
    FileShareProvider: provider('FileShareProvider'),
    downloadArtifactsFromBuild: async (options: any) => {
        console.log('DOWNLOAD ' + JSON.stringify(options.params));
    }
});

tr.run();
