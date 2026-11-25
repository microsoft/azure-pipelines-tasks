import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'main.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('versionSpec', '3.x');
taskRunner.setInput('addToPath', 'false');
taskRunner.setInput('architecture', 'x64-invalid');

taskRunner.run();
