import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setDebugState(true);
tmr.setInput('command', 'custom');
tmr.setInput('workingDirectory', '');
tmr.setInput('customCommand', '-v');
tmr.setExecResponse('npm -v', {
    code: 0,
    stdout: '4.6.1'
} as TaskLibAnswerExecResult);
tmr.run();
