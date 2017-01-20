import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('./NpmMockHelper');
import fs = require('fs');
var Stats = require('fs').Stats

let taskPath = path.join(__dirname, '..', 'npmtask.js');
let taskMockRunner = new tmrm.TaskMockRunner(taskPath);
let npmMockHelper = new util.NpmMockHelper(taskMockRunner, "config get", "registry");

fs.statSync = (s) => {
    let stat = new Stats;
    stat.isFile = () => {
        return false;
    }

    return stat;
}
taskMockRunner.registerMock('fs', fs);

npmMockHelper.run();
