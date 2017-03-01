import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');
import GulpMockHelper = require('./GulpMockHelper');

let taskPath = path.join(__dirname, '..', 'gulptask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "/user/build";

tr.setInput('gulpFile', 'gulpfile.js');
if (os.type().match(/^Win/)) {
    tr.setInput('cwd', 'c:/fake/wd');
}
else {
    tr.setInput('cwd', '/fake/wd');
}

let a: ma.TaskLibAnswers = GulpMockHelper.gulpLocalGood;

tr.setAnswers(a);
tr.run();