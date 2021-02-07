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
tr.setInput("enableCodeCoverage", "false");
tr.setInput("gulpjs", "node_modules/gulp/gulp.js");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "npm": "/usr/local/bin/npm",
        "node": "/usr/local/bin/node",
        "istanbulWin": "/usr/local/bin/istanbul",
        "istanbul": "/usr/local/bin/node_modules/istanbul/lib/cli.js",
    },
    "exec": {
        "/usr/local/bin/node /fake/wd/node_modules/gulp/gulp.js --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here",
        },
        "/usr/local/bin/node c:\\fake\\wd\\node_modules\\gulp\\gulp.js --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here",
        },
    },
    "checkPath": {
        "/usr/local/bin/node": true,
        "/usr/local/bin/npm": true,
        "/usr/local/bin/istanbul": true,
        "/usr/local/bin/node_modules/istanbul/lib/cli.js": true,
        "gulpfile.js": true,
    },
    "exist": {
        "/fake/wd/node_modules/gulp/gulp.js": true,
        "c:\\fake\\wd\\node_modules\\gulp\\gulp.js": true,
    },
    "match": {
        "**/TEST-*.xml": ["/user/build/fun/test-123.xml"],
    },
};
tr.setAnswers(a);

tr.run();
