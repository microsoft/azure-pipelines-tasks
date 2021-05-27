import ma = require("azure-pipelines-task-lib/mock-answer");
import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import os = require("os");

let taskPath = path.join(__dirname, "..", "grunttask.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("gruntFile", "gruntfile.js");
tr.setInput("publishJUnitResults", "true");
tr.setInput("testResultsFiles", "**/test-*.xml");
tr.setInput("enableCodeCoverage", "false");
if (os.type().match(/^Win/)) {
    tr.setInput("cwd", "c:/fake/wd");
} else {
    tr.setInput("cwd", "/fake/wd");
}
tr.setInput("gruntCli", "node_modules/grunt-cli/bin/grunt");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "npm": "/usr/local/bin/npm",
        "node": "/usr/local/bin/node",
        "istanbulWin": "/usr/local/bin/istanbul",
        "istanbul": "/usr/local/bin/node_modules/istanbul/lib/cli.js",
    },
    "exec": {
        "/usr/local/bin/node /fake/wd/node_modules/grunt-cli/bin/grunt --gruntfile gruntfile.js": {
            "code": 0,
            "stdout": "grunt output here",
        },
        "/usr/local/bin/node c:\\fake\\wd\\node_modules\\grunt-cli\\bin\\grunt --gruntfile gruntfile.js": {
            "code": 0,
            "stdout": "grunt output here",
        },
    },
    "checkPath": {
        "/usr/local/bin/node": true,
        "/usr/local/bin/npm": true,
        "/usr/local/bin/istanbul": true,
        "/usr/local/bin/node_modules/istanbul/lib/cli.js": true,
        "gruntfile.js": true,
    },
    "exist": {
        "/fake/wd/node_modules/grunt-cli/bin/grunt": true,
        "c:\\fake\\wd\\node_modules\\grunt-cli\\bin\\grunt": true,
    },
    "find": {
        "/user/build": ["/user/build/fun/test-123.xml"],
    },
    "match": {
        "**/test-*.xml": ["/user/build/fun/test-123.xml"],
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "/user/build",
    },
};

tr.setAnswers(a);

tr.run();
