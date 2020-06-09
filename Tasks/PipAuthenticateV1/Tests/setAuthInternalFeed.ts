import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./PipMockHelper');

let taskPath = path.join(__dirname, '..', 'pipauthenticatemain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let pmh: util.PipMockHelper = new util.PipMockHelper(tmr);

tmr.setInput('artifactFeeds', 'TestFeed');
tmr.setInput('onlyAddExtraIndex', 'false');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {},
    "which": {},
    "exist": {},
    "stats": {}
};
tmr.setAnswers(a);

tmr.run();
