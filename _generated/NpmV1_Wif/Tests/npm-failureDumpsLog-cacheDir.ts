import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.CustomCommand, 'custom');
tmr.setInput(NpmTaskInput.WorkingDir, 'C:\\mock\\cache');
tmr.mockNpmCommand('custom', {
    code: -1,
    stdout: 'some npm failure'
} as TaskLibAnswerExecResult);
tmr.answers.exist['C:\\mock\\cache\\npm-debug.log'] = false;
tmr.answers["stats"] = {"C:\\mock\\cache": {"isDirectory":true}};
tmr.answers.findMatch['*-debug.log'] = [
    'someRandomNpm-debug.log'
];
let fs = require('fs');
fs.writeFileSync('someRandomNpm-debug.log', 'NPM_DEBUG_LOG', 'utf-8');
tmr.run();

