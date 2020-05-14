import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput, RegistryLocation } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Install);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.setInput(NpmTaskInput.CustomRegistry, RegistryLocation.Feed);
tmr.setInput(NpmTaskInput.CustomFeed, 'SomeFeedId');
tmr.answers["stats"] = {};
tmr.answers["stats"][process.cwd()] = {"isDirectory":true};
tmr.mockNpmCommand('install', {
    code: 0,
    stdout: 'npm install successful'
} as TaskLibAnswerExecResult);
tmr.answers.rmRF[path.join(process.cwd(), '.npmrc')] = { success: true };

tmr.run();
