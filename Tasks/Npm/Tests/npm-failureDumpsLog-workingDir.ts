import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.CustomCommand, 'custom');
tmr.setInput(NpmTaskInput.WorkingDir, NpmMockHelper.WorkingDir);
tmr.mockNpmCommand('custom', {
    code: -1,
    stdout: 'some npm failure'
} as TaskLibAnswerExecResult);
tmr.answers.exist[path.join(NpmMockHelper.WorkingDir, NpmMockHelper.NpmDebugLogFile)] = true;
tmr.answers["stats"] = {"C:\\mock\\workingDir": {"isDirectory":true}};

let mockFs = require('fs');
tmr.registerMock('fs', mockFs);
mockFs.readFile = (a, b, cb) => {
    cb(undefined, NpmMockHelper.NpmDebugLogFile);
};

tmr.run();
