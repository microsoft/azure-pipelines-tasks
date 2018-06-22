import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'dotnetcoreinstaller.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");

process.env["AGENT_TOOLSDIRECTORY"] = "C:\\agent\\_tools";
process.env["AGENT_TEMPDIRECTORY"] = "C:\\agent\\_temp";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "C:\\somedir\\powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command & 'C:\\currDir\\externals\\install-dotnet.ps1' -Version 1.0.4 -DryRun": {
            "code": process.env["__get_platform_failed__"] === "true" ? -1 : 0,
            "stdout": process.env["__get_platform_failed__"] === "true" ? "" : "dotnet-install: Payload URLs:" + os.EOL + "dotnet-install: Primary - https://primary-url" + os.EOL + "dotnet-install: Legacy - https://legacy-url" + os.EOL + "dotnet-install: Repeatable invocation: .\install-dotnet.ps1 -Version 1.1.2 -Channel 1.1 -Architecture x64 -InstallDir <auto>",
            "stderr": process.env["__get_platform_failed__"] === "true" ? "install-script failed to get donwload urls" : ""
        }
    },
    "osType": {
        "osType": "Windows_NT"
    },
    "which": {
        "powershell": "C:\\somedir\\powershell.exe"
    },
    "checkPath": {
        "C:\\somedir\\powershell.exe": true
    }
};

var ut = require('../utilities');
tr.registerMock('./utilities', {
    getCurrentDir: function () {
        return "C:\\currDir";
    },
    setFileAttribute: ut.setFileAttribute
});

tr.registerMock('utility-common/downloadutility', {
    readFileContent: function (fileUrl: string) {
        switch (process.env["__releases_info__"]) {
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