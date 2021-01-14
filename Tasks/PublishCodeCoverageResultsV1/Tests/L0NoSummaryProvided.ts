import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

let taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
let tr: TaskMockRunner = new TaskMockRunner(taskPath);

tr.setInput('codeCoverageTool', 'JaCoCo');

tr.setAnswers(answers.defaultAnswers);

tr.run();
