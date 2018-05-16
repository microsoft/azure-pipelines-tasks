import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Install);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.mockNpmCommand('install', {
    code: -1,
    stdout: 'some npm failure'
} as TaskLibAnswerExecResult);
tmr.run();
