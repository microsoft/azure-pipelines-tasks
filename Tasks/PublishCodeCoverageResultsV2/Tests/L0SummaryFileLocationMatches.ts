import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);

tr.setInput('summaryFileLocation', 'FilesForTesting\coverage.cobertura (4) (1).xml');
tr.setAnswers(answers.defaultAnswers);

tr.run();
