import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishtestresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);

let pattern = path.join(__dirname, 'data', '*.log');
tr.setInput('testRunner', 'JUnit');
tr.setInput('testResultsFiles', pattern);
tr.setInput('mergeTestResults', 'true');

tr.setAnswers(answers.defaultAnswers);

tr.run();
