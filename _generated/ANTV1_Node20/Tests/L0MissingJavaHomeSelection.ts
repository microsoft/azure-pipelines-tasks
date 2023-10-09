import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

let taskPath = path.join(__dirname, '..', 'anttask.js');
let runner: TaskMockRunner = new TaskMockRunner(taskPath);

runner.setInput('antBuildFile', '/build/build.xml');
runner.setInput('jdkVersion', 'default');
runner.setInput('testResultsFiles', '**/TEST-*.xml');

runner.setAnswers(answers.successAnswers);

runner.run();
