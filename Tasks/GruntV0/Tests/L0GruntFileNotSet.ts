import ma = require("azure-pipelines-task-lib/mock-answer");
import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import os = require("os");

let taskPath = path.join(__dirname, "..", "grunttask.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("publishJUnitResults", "true");
tr.setInput("testResultsFiles", "**/build/test-results/TEST-*.xml");
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
        "grunt": "/usr/local/bin/grunt",
        "npm": "/usr/local/bin/npm",
        "node": "/usr/local/bin/node",
        "istanbulWin": "/usr/local/bin/istanbul",
        "istanbul": "/usr/local/bin/node_modules/istanbul/lib/cli.js",
    },
    "exec": {
        "/usr/local/bin/grunt --gruntfile gruntfile.js": {
            "code": 0,
            "stdout": "grunt output here",
        },
        "/usr/local/bin/npm install istanbul": {
            "code": 0,
            "stdout": "npm output here",
        },
        "/usr/local/bin/node ./node_modules/istanbul/lib/cli.js cover --report cobertura --report html -i ./**/build/src/*.js ./node_modules/mocha/bin/_mocha **/build/test/*.js": {
            "code": 0,
            "stdout": "istanbul output here",
        },
        "/usr/local/bin/node ./node_modules/istanbul/lib/cli.js cover --report cobertura --report html -i .\\**\\build\\src\\*.js ./node_modules/mocha/bin/_mocha **/build/test/*.js": {
            "code": 0,
            "stdout": "istanbul output here",
        },
    },
    "checkPath": {
        "/usr/local/bin/grunt": true,
        "/usr/local/bin/npm": true,
        "/usr/local/bin/node": true,
        "/usr/local/bin/istanbul": true,
        "/usr/local/bin/node_modules/istanbul/lib/cli.js": true,
        "gruntfile.js": true,
        "**/build/test/*.js": true,
    },
    "exist": {
        "/usr/local/bin/grunt": true,
    },
    "match": {
        "**/TEST-*.xml": ["/user/build/fun/test-123.xml"],
        "**/*.js": ["/test/test.js"],
    },
};
tr.setAnswers(a);

tr.run();
