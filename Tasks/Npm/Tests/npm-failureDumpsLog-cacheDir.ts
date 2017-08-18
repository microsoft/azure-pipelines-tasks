import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';


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
    'C:\\mock\cache\\_logs\\someRandomNpm-debug.log'
];
let mockFs = require('fs');
tmr.registerMock('fs', mockFs);
mockFs.readFile = (a, b, cb) => {
    cb(undefined, 'NPM_DEBUG_LOG');
};
tmr.run();

