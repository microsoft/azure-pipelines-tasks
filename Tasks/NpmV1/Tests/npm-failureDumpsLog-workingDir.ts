import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let cwd = process.cwd();
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.CustomCommand, 'custom');
tmr.setInput(NpmTaskInput.WorkingDir, cwd);
tmr.mockNpmCommand('custom', {
    code: -1,
    stdout: 'some npm failure'
} as TaskLibAnswerExecResult);

tmr.answers.exist[path.join(cwd, "npm-debug.log")] = true;
tmr.answers["stats"] = { [cwd] : { "isDirectory": true } };

let fs = require('fs');
fs.writeFileSync('npm-debug.log', 'NPM_DEBUG_LOG', 'utf-8');

tmr.run();
