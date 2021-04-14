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
tr.setInput("publishJUnitResults", "true");
tr.setInput("testResultsFiles", "**/build/test-results/TEST-*.xml");
tr.setInput("enableCodeCoverage", "true");
tr.setInput("testFramework", "Mocha");
tr.setInput("srcFiles", "**/build/src/*.js");
tr.setInput("testFiles", "**/build/test/*.js");
tr.setInput("gulpjs", "node_modules/gulp/gulp.js");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "gulp": "/usr/local/bin/gulp",
        "npm": "/usr/local/bin/npm",
        "node": "/usr/local/bin/node",
        "istanbulWin": "/usr/local/bin/istanbul",
        "istanbul": "/usr/local/bin/node_modules/istanbul/lib/cli.js",
    },
    "exec": {
        "/usr/local/bin/gulp --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here",
        },
        "/usr/local/bin/npm install istanbul": {
            "code": 1,
            "stdout": "npm output here",
            "stderr": "npm failed with this output",
        },
    },
    "checkPath": {
        "/usr/local/bin/gulp": true,
        "/usr/local/bin/npm": true,
        "/usr/local/bin/node": true,
        "/usr/local/bin/istanbul": true,
        "/usr/local/bin/node_modules/istanbul/lib/cli.js": true,
        "gulpfile.js": true,
    },
    "exist": {
        "/usr/local/bin/gulp": true,
    },
    "match": {
        "**/TEST-*.xml": ["/user/build/fun/test-123.xml"],
        "**/*.js": ["/test/test.js"],
    },
    "find": {
        "/user/build": ["/user/build/fun/test-123.xml"],
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "/user/build",
    },
};
tr.setAnswers(a);

tr.run();
