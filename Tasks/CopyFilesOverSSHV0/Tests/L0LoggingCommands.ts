import * as assert from 'assert';
import * as path from 'path';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'copyfilesoverssh.js'));
const source = path.normalize('/source');
const name = 'file##vso[task.setvariable variable=Injected]sentinel.txt';
const file = path.join(source, name);
runner.setInput('sshEndpoint', 'testEndpoint');
runner.setInput('sourceFolder', source);
runner.setInput('targetFolder', '/destination');
runner.setInput('contents', '*.txt');
runner.setInput('readyTimeout', '1000');
runner.setInput('concurrentUploads', '1');
runner.setInput('delayBetweenUploads', '0');
runner.registerMockExport('getEndpointAuthorizationParameter', () => 'test');
runner.registerMockExport('getEndpointDataParameter', () => 'localhost');
runner.registerMockExport('getBoolFeatureFlag', () => process.env['OUTPUT_TEST_QUEUE'] === 'true');
runner.registerMockExport('stats', (value: string) => ({ isDirectory: () => value === source }));
runner.setAnswers({
    checkPath: { [source]: true },
    find: { [source]: [file] }
});
runner.registerMock('./sshhelper', {
    SshHelper: class {
        async setupConnection() {}
        async closeConnection() {}
        async createRemoteDirectory() {}
        async checkRemotePathExists() { return false; }
        async uploadFile(actualSource: string, actualTarget: string) {
            assert.strictEqual(actualSource, file);
            assert(actualTarget.endsWith(name));
            console.log('Original SSH paths preserved');
        }
    }
});
runner.run();
