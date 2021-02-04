import ma = require("azure-pipelines-task-lib/mock-answer");
import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import os = require("os");

let taskPath = path.join(__dirname, "..", "gulptask.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

if (os.type().match(/^Win/)) {
    tr.setInput("cwd", "c:/fake/wd");
} else {
    tr.setInput("cwd", "/fake/wd");
}

tr.setInput("gulpFile", "gulpfile.js");
tr.setInput("gulpjs", "node_modules/gulp/gulp.js");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath": {
        "gulpfile.js": false,
    },
};
tr.setAnswers(a);

tr.run();
