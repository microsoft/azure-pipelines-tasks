import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'dotnetcoreinstaller.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");

process.env["AGENT_TOOLSDIRECTORY"] = "/agent/_tools";
process.env["AGENT_TEMPDIRECTORY"] = "/agent/_temp";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "/somedir/currdir/externals/get-os-distro.sh": {
            "code": process.env["__get_platform_failed__"] === "true" ? -1 : 0,
            "stdout": process.env["__get_platform_failed__"] === "true" ? "" : "Primary:linux-x64" + os.EOL + "Legacy:ubuntu.16.04",
            "stderr": process.env["__get_platform_failed__"] === "true" ? "OS name could not be detected" : ""
        }
    },
    "osType": {
        "osType": "Linux"
    },
    "which": {
        "/somedir/currdir/externals/get-os-distro.sh": "/somedir/currdir/externals/get-os-distro.sh"
    },
    "checkPath": {
        "/somedir/currdir/externals/get-os-distro.sh": true
    }
};

var ut = require('../utilities');
tr.registerMock('./utilities', {
    getCurrentDir: function () {
        return "/somedir/currdir";
    },
    setFileAttribute: function (file, mode) {
        console.log("Changing attribute for file " + file + " to " + mode);
    }
});

tr.registerMock('utility-common/downloadutility', {
    readFileContent: function (fileUrl: string) {
        switch (process.env["__releases_info__"]) {
            case "LegacyVersion":
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/LegacyVersion.json"));
            case "RuntimeBlobUrlNotAvailable":
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/RuntimeBlobUrlNotAvailable.json"));
            case "SdkBlobUrlNotAvailable":
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/SdkBlobUrlNotAvailable.json"));
            case "RuntimeVersionInvalid":
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/RuntimeVersionInvalid.json"));
            case "SdkVersionInvalid":
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/SdkVersionInvalid.json"));
            default:
                return fs.readFileSync(path.join(__dirname, "MockReleaseJsons/NewVersion.json"));
        }
    },
});

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.registerMock('vsts-task-tool-lib/tool', require('./mock_node_modules/tool'));
tr.run();
