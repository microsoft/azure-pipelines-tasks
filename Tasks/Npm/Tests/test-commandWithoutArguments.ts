import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('./NpmMockHelper');

let taskPath = path.join(__dirname, '..', 'npmtask.js');
let taskMockRunner = new tmrm.TaskMockRunner(taskPath);
let npmMockHelper = new util.NpmMockHelper(taskMockRunner, "root", "");

npmMockHelper.useDeprecatedTask();

let root = path.join(process.env['INPUT_CWD'], "node_modules");

var execResult: ma.TaskLibAnswerExecResult = {
    code: 0,
    stdout: root,
    stderr: ""
};

npmMockHelper.run(execResult);
