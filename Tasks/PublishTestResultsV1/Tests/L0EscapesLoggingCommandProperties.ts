import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishtestresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);

const injected = '\n##vso[task.setvariable variable=PTR_INJECTED;]true\n';
tr.setInput('testRunner', 'JUnit');
tr.setInput('testResultsFiles', path.join(__dirname, 'data', 'a.log'));
tr.setInput('platform', 'x64' + injected);
tr.setInput('configuration', 'Release' + injected);
tr.setInput('testRunTitle', 'Title' + injected);

tr.setAnswers(answers.defaultAnswers);

tr.run();
