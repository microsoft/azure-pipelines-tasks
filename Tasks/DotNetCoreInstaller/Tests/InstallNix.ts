import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'dotnetcoreinstaller.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");

process.env["AGENT_TOOLSDIRECTORY"] = "/agent/_tools";
process.env["AGENT_TEMPDIRECTORY"] = "/agent/_temp";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "/somedir/currdir/externals/install-dotnet.sh --version 1.0.4 --dry-run": {
            "code": process.env["__get_dlurls_failed__"] === "true" ? -1 : 0,
            "stdout": process.env["__get_dlurls_failed__"] === "true" ? "" : "dotnet-install: Payload URLs:" + os.EOL + "dotnet-install: Payload URL: https://primary-url" + os.EOL + "dotnet-install: Legacy payload URL: https://legacy-url" + os.EOL + "dotnet-install: Repeatable invocation:",
            "stderr": process.env["__get_dlurls_failed__"] === "true" ? "install-script failed to get donwload urls" : ""
        },
        "/somedir/currdir/externals/install-dotnet.sh --version 1.0.4 --dry-run --shared-runtime": {
            "code": 0,
            "stdout": "dotnet-install: Payload URLs:" + os.EOL + "dotnet-install: Payload URL: https://primary-runtime-url" + os.EOL + "dotnet-install: Legacy payload URL: https://legacy-runtime-url" + os.EOL + "dotnet-install: Repeatable invocation:"
        }
    },
    "osType": {
        "osType": "Linux"
    },
    "which": {
        "/somedir/currdir/externals/install-dotnet.sh": "/somedir/currdir/externals/install-dotnet.sh"
    },
    "checkPath": {
        "/somedir/currdir/externals/install-dotnet.sh": true
    }
};

var ut = require('../utilities');
tr.registerMock('./utilities', {
    getCurrentDir : function() {
        return "/somedir/currdir";
    },
    setFileAttribute: function(file, mode) {
        console.log("Changing attribute for file " + file + " to " + mode);
    }
});

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.registerMock('vsts-task-tool-lib/tool', require('./mock_node_modules/tool'));
tr.run();