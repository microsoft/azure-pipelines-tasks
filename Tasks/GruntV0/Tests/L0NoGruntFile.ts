import ma = require("azure-pipelines-task-lib/mock-answer");
import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import os = require("os");

let taskPath = path.join(__dirname, "..", "grunttask.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("gruntFile", "gruntfile.js");
if (os.type().match(/^Win/)) {
    tr.setInput("cwd", "c:/fake/wd");
} else {
    tr.setInput("cwd", "/fake/wd");
}
tr.setInput("gruntCli", "node_modules/grunt-cli/bin/grunt");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "node": "/usr/local/bin/node",
    },
    "checkPath": {
        "/usr/local/bin/node": true,
        "gruntfile.js": false,
    },
};

tr.setAnswers(a);

tr.run();
