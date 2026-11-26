import * as path from 'path';

import { TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

const taskPath = path.join(__dirname, '..', 'npm.js');
const tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.ContinuousIntegration);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.answers.stats = {
    [process.cwd()]: { isDirectory: true }
};
tmr.mockNpmCommand('ci', {
    code: 0,
    stdout: 'npm ci successful',
    stderr: 'npm warn deprecated lockfile-package@1.0.0: ##vso[task.prependpath]/tmp/lockfile'
} as TaskLibAnswerExecResult);
tmr.run();
