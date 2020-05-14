import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput, RegistryLocation } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Publish);
tmr.setInput(NpmTaskInput.WorkingDir, 'workingDir');
tmr.setInput(NpmTaskInput.PublishRegistry, RegistryLocation.External);
tmr.setInput(NpmTaskInput.PublishEndpoint, 'SomeEndpointId');
let auth = {
    scheme: 'Token',
    parameters: {
        'apitoken': 'AUTHTOKEN'
    }
};
tmr.mockServiceEndpoint('SomeEndpointId', 'http://url', auth);
tmr.mockNpmCommand('publish', {
    code: 0,
    stdout: 'npm publish successful'
} as TaskLibAnswerExecResult);
tmr.answers.rmRF[path.join('workingDir', '.npmrc')] = { success: true };
tmr.answers["stats"] = {"workingDir": {"isDirectory":true}};

tmr.run();
