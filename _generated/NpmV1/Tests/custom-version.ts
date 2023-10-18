import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setDebugState(true);
tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.answers["stats"] = {};
tmr.answers["stats"][process.cwd()] = {"isDirectory":true};
tmr.setInput(NpmTaskInput.CustomCommand, '-v');
tmr.mockNpmCommand('-v', {
    code: 0,
    stdout: '4.6.1'
} as TaskLibAnswerExecResult);
tmr.run();
