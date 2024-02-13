import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);

tr.setInput('summaryFileLocation', 'TestFiles\sampempty.xml');

tr.setAnswers(answers.emptyAnswers);

tr.run();
