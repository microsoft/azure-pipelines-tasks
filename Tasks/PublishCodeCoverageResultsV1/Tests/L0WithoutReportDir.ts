import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

let taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
let tr: TaskMockRunner = new TaskMockRunner(taskPath);

tr.setInput('codeCoverageTool', 'Cobertura');
tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

tr.setAnswers(answers.defaultAnswers);

tr.run();
