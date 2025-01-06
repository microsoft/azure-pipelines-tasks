import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

let taskPath = path.join(__dirname, '..', 'anttask.js');
let runner: TaskMockRunner = new TaskMockRunner(taskPath);

runner.setInput('antBuildFile', '/build/build.xml');
runner.setInput('javaHomeSelection', 'JDKVersion');
runner.setInput('jdkVersion', '1.5');
runner.setInput('jdkArchitecture', 'x86');
runner.setInput('testResultsFiles', '**/TEST-*.xml');

runner.setAnswers(answers.successAnswers);

runner.run();
