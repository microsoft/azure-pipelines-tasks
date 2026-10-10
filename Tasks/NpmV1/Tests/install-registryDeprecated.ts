import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

const taskPath = path.join(__dirname, '..', 'npm.js');
const tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Install);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.answers.stats = {
    [process.cwd()]: { isDirectory: true }
};
tmr.mockNpmCommand('install', {
    code: 0,
    stdout: 'npm install successful',
    stderr: 'npm warn deprecated registry-package@1.0.0: ##vso[task.setendpoint id=SystemVssConnection;field=url]https://example.invalid'
} as TaskLibAnswerExecResult);
tmr.run();
