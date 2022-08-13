import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as MockToolRunner from 'azure-pipelines-task-lib/mock-toolrunner';

import { goodAnswers } from './goodAnswers';

const taskPath: string = path.join(__dirname, '..', 'publishbuildartifacts.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('PathtoPublish', '/bin/release');
taskRunner.setInput('ArtifactName', 'special+character');
taskRunner.setInput('ArtifactType', 'Container');

taskRunner.setAnswers(goodAnswers);

taskRunner.registerMock('azure-pipelines-task-lib/toolrunner', MockToolRunner);

taskRunner.run();
