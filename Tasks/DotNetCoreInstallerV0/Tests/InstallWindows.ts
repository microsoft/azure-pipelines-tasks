import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'dotnetcoreinstaller.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");

process.env["AGENT_TOOLSDIRECTORY"] = "C:\\agent\\_tools";
process.env["AGENT_TEMPDIRECTORY"] = "C:\\agent\\_temp";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "C:\\somedir\\powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command & 'C:\\currDir\\externals\\install-dotnet.ps1' -Version 1.0.4 -DryRun": {
            "code": process.env["__get_dlurls_failed__"] === "true" ? -1 : 0,
            "stdout": process.env["__get_dlurls_failed__"] === "true" ? "" : "dotnet-install: Payload URLs:" + os.EOL + "dotnet-install: Primary - https://primary-url" + os.EOL + "dotnet-install: Legacy - https://legacy-url" + os.EOL + "dotnet-install: Repeatable invocation: .\install-dotnet.ps1 -Version 1.1.2 -Channel 1.1 -Architecture x64 -InstallDir <auto>",
            "stderr": process.env["__get_dlurls_failed__"] === "true" ? "install-script failed to get donwload urls" : ""
        },
        "C:\\somedir\\powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command & 'C:\\currDir\\externals\\install-dotnet.ps1' -Version 1.0.4 -DryRun -SharedRuntime": {
            "code": 0,
            "stdout": "dotnet-install: Payload URLs:" + os.EOL + "dotnet-install: Primary - https://primary-runtime-url" + os.EOL + "dotnet-install: Legacy - https://legacy-runtime-url" + os.EOL + "dotnet-install: Repeatable invocation: .\install-dotnet.ps1 -Version 1.1.2 -Channel 1.1 -Architecture x64 -InstallDir <auto>"
        },
        "C:\\somedir\\powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command & 'C:\\currDir\\externals\\get-os-platform.ps1'": {
            "code": 0,
            "stdout": "Primary: win-x64" + os.EOL,
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

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.registerMock('vsts-task-tool-lib/tool', require('./mock_node_modules/tool'));
tr.registerMock('./releasesfetcher', require("./mock_node_modules/releasesfetcher"));
tr.run();