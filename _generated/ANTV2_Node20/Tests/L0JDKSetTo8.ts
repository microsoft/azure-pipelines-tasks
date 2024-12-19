import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

let taskPath = path.join(__dirname, '..', 'anttask.js');
let runner: TaskMockRunner = new TaskMockRunner(taskPath);

runner.setInput('antBuildFile', '/build/build.xml');
runner.setInput('javaHomeSelection', 'JDKVersion');
runner.setInput('jdkVersion', '1.8');
runner.setInput('jdkArchitecture', 'x86');
runner.setInput('testResultsFiles', '**/TEST-*.xml');

runner.setAnswers(answers.successAnswers);

process.env['JAVA_HOME_8_X86'] = '/user/local/bin/ANT8';
process.env['JAVA_HOME_8_X64'] = '/user/local/bin/ANT8';

runner.run();
