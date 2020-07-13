import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput, RegistryLocation } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Install);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.setInput(NpmTaskInput.CustomRegistry, RegistryLocation.Npmrc);
tmr.setInput(NpmTaskInput.CustomEndpoint, '1,2');
let auth = {
    scheme: 'Token',
    parameters: {
        'apitoken': 'AUTHTOKEN'
    }
};
tmr.mockServiceEndpoint('1', 'http://example.com/1/', auth);
tmr.mockServiceEndpoint('2', 'http://example.com/2/', auth);
tmr.answers["stats"] = {};
tmr.answers["stats"][process.cwd()] = {"isDirectory":true};
tmr.mockNpmCommand('install', {
    code: 0,
    stdout: 'npm install successful'
} as TaskLibAnswerExecResult);

tmr.run();
