import ma = require("azure-pipelines-task-lib/mock-answer");
import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import util = require("./TwineMockHelper");

let taskPath = path.join(__dirname, '..', 'twineauthenticatemain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let tmh: util.TwineMockHelper = new util.TwineMockHelper(tmr);

tmr.setInput('artifactFeed', 'Test.Feed');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {},
    "which": {},
    "exist": {},
    "stats": {}
};
tmr.setAnswers(a);

tmr.run();
