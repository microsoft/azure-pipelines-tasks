import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xamarinandroid.js');
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);

// taskRunner.setInput('project', '**/Single*.csproj'); // Project input missing
taskRunner.setInput('target', '');
taskRunner.setInput('clean', 'false');
taskRunner.setInput('createAppPackage', 'true');
taskRunner.setInput('outputDir', '');
taskRunner.setInput('configuration', '');
taskRunner.setInput('msbuildLocation', '');
taskRunner.setInput('msbuildArguments', '');
taskRunner.setInput('javaHomeSelection', 'JDKVersion');
taskRunner.setInput('jdkVersion', 'default');

taskRunner.run();
