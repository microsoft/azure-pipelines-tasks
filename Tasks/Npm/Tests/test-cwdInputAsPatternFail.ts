import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('./NpmMockHelper');

let taskPath = path.join(__dirname, '..', 'npmtask.js');
let taskMockRunner = new tmrm.TaskMockRunner(taskPath);
taskMockRunner.registerMock("nuget-task-common/utility.js", {
    resolveFilterSpec: function (filterSpec, basePath?, allowEmptyMatch?) {
        throw new Error("No matching files were found with search pattern: " + filterSpec);
    }
});
let npmMockHelper = new util.NpmMockHelper(taskMockRunner, "config", "list", "**/package.json");
process.env['USERPROFILE'] = 'C:\\Users\\none';

if (process.argv.length == 3) {
    if (process.argv[2] === "useDeprecated") {
        npmMockHelper.useDeprecatedTask();
    }
} 

npmMockHelper.setDebugState(true);
npmMockHelper.mockAuthHelper();
npmMockHelper.mockNpmConfigList();

var execResult: ma.TaskLibAnswerExecResult = {
    code: 0,
    stdout: "; cli configs",
    stderr: ""
};

npmMockHelper.run(execResult);
