import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

import { goodAnswers } from './goodAnswers';

const taskPath: string = path.join(__dirname, '..', 'publishbuildartifacts.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('PathtoPublish', '/bin/release');
taskRunner.setInput('ArtifactName', 'drop');
taskRunner.setInput('ArtifactType', 'Container');

taskRunner.setAnswers(goodAnswers);

taskRunner.run();
