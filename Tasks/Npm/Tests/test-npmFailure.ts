import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('./NpmMockHelper');

let taskPath = path.join(__dirname, '..', 'npmtask.js');
let taskMockRunner = new tmrm.TaskMockRunner(taskPath);
let npmMockHelper = new util.NpmMockHelper(taskMockRunner, "root", "");

npmMockHelper.useDeprecatedTask();

let mock = require('vsts-task-lib/mock-toolrunner');
mock.exec = () => {
    throw "tool failure";
};

var execResult: ma.TaskLibAnswerExecResult = {
    code: 0,
    stdout: "",
    stderr: "some error"
};

npmMockHelper.run(execResult);
