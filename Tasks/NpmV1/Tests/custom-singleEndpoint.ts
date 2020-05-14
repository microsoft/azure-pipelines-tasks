import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput, RegistryLocation } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.CustomCommand, 'mockcmd');
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.setInput(NpmTaskInput.CustomRegistry, RegistryLocation.Npmrc);
tmr.setInput(NpmTaskInput.CustomEndpoint, '1');
let auth = {
    scheme: 'Token',
    parameters: {
        'apitoken': 'AUTHTOKEN'
    }
};
tmr.mockServiceEndpoint('1', 'http://example.com/1/', auth);
tmr.mockNpmCommand('mockcmd', {
    code: 0,
    stdout: 'npm custom successful'
} as TaskLibAnswerExecResult);
tmr.answers["stats"] = {};
tmr.answers["stats"][process.cwd()] = {"isDirectory":true};

tmr.run();
