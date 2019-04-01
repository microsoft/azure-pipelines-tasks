import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import taskLib = require('azure-pipelines-task-lib/task');
import path = require('path');
import os = require('os');
import auth = require('packaging-common/nuget/Authentication');

import { chmodSync } from 'fs';

let taskPath = path.join(__dirname, '..', 'usedotnet.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");
tr.setInput("proxy", process.env["__proxy__"] || 'false');

process.env["AGENT_TOOLSDIRECTORY"] = "C:\\agent\\_tools";

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
        },
        "C:\\somedir\\nuget.exe config -set http_proxy=https://proxy.com": {
            "code": 0,
            "stdout": "Set proxy url" + os.EOL
        },
        "C:\\somedir\\nuget.exe config -set http_proxy.user=username": {
            "code": 0,
            "stdout": "Set proxy username" + os.EOL
        },
        "C:\\somedir\\nuget.exe config -set http_proxy.password=password": {
            "code": 0,
            "stdout": "Set proxy password" + os.EOL
        }
    },
    "osType": {
        "osType": "Windows_NT"
    },
    "which": {
        "powershell": "C:\\somedir\\powershell.exe",
        "nuget": "C:\\somedir\\nuget.exe"
    },
    "checkPath": {
        "C:\\somedir\\powershell.exe": true
    }
};

tr.registerMock('./utilities', {
    getDirname: function () {
        return "C:\\currDir";
    },
    setFileAttribute: function (file, mode) {
        chmodSync(file, mode);
    }
});

tr.registerMock('packaging-common/nuget/NuGetToolGetter', {
    getNuGet: function(version: string) {
        console.log('Getting nuget version', version);
    }
});

if (process.env["__proxy__"]) {
    const tl = require('azure-pipelines-task-lib/mock-task');
    const tlClone = Object.assign({}, tl);
    tlClone.getHttpProxyConfiguration = function(requestUrl?: string): taskLib.ProxyConfiguration | null {
        return { proxyUrl: 'https://proxy.com', proxyUsername: 'username', proxyPassword: 'password', proxyBypassHosts: null};
    }
    tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);
}

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tool-lib/tool', require('./mock_node_modules/tool'));
tr.registerMock('./releasesfetcher', require("./mock_node_modules/releasesfetcher"));
tr.run();