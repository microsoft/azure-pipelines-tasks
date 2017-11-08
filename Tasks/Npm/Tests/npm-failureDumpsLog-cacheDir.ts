import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Custom);
tmr.setInput(NpmTaskInput.CustomCommand, 'custom');
tmr.setInput(NpmTaskInput.WorkingDir, NpmMockHelper.NpmCacheDir);
tmr.mockNpmCommand('custom', {
    code: -1,
    stdout: 'some npm failure'
} as TaskLibAnswerExecResult);
tmr.answers.exist[path.join(NpmMockHelper.WorkingDir, NpmMockHelper.NpmDebugLogFile)] = false;
tmr.answers["stats"] = {"C:\\mock\\cache": {"isDirectory":true}};
tmr.answers.findMatch['*-debug.log'] = [
    path.join(NpmMockHelper.NpmCacheDir, NpmMockHelper.NpmRandomLogFile)
];
let mockFs = require('fs');
tmr.registerMock('fs', mockFs);
mockFs.readFile = (a, b, cb) => {
    cb(undefined, 'NPM_DEBUG_LOG');
};
tmr.run();

