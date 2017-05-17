import * as path from 'path';

import { TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';

import { NpmCommand, NpmTaskInput, RegistryLocation } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

let taskPath = path.join(__dirname, '..', 'npm.js');
let tmr = new NpmMockHelper(taskPath);

tmr.setInput(NpmTaskInput.Command, NpmCommand.Install);
tmr.setInput(NpmTaskInput.WorkingDir, '');
tmr.setInput(NpmTaskInput.CustomRegistry, RegistryLocation.Feed);
tmr.setInput(NpmTaskInput.CustomFeed, 'SomeFeedId');
tmr.setExecResponse('npm install', {
    code: 0,
    stdout: 'npm install successful'
} as TaskLibAnswerExecResult);
tmr.RegisterLocationServiceMocks();

tmr.run();
