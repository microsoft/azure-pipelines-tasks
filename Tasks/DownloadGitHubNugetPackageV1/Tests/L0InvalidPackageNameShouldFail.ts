import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as ma from 'azure-pipelines-task-lib/mock-answer';

const taskPath = path.join(__dirname, '..', 'dotnetrestore.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('packageName', 'test');
tr.setInput('version', '1.0');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
  "osType": {
      "osType": "WindowsNT"
  }
};
tr.setAnswers(a);

tr.run();