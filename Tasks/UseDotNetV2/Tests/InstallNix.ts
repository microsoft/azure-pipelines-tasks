import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import taskLib = require('azure-pipelines-task-lib/task');
import path = require('path');
import os = require('os');
import auth = require('packaging-common/nuget/Authentication');

let taskPath = path.join(__dirname, '..', 'usedotnet.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");
tr.setInput("proxy", process.env["__proxy__"] || 'false');

process.env["AGENT_TOOLSDIRECTORY"] = "/agent/_tools";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "/somedir/currdir/externals/get-os-distro.sh": {
            "code": 0,
            "stdout": "Primary: linux" + os.EOL
        },
        "/somedir/nuget.exe config -set http_proxy=https://proxy.com": {
            "code": 0,
            "stdout": "Set proxy url" + os.EOL
        },
        "/somedir/nuget.exe config -set http_proxy.user=username": {
            "code": 0,
            "stdout": "Set proxy username" + os.EOL
        },
        "/somedir/nuget.exe config -set http_proxy.password=password": {
            "code": 0,
            "stdout": "Set proxy password" + os.EOL
        }
    },
    "osType": {
        "osType": "Linux"
    },
    "which": {
        "/somedir/currdir/externals/get-os-distro.sh": "/somedir/currdir/externals/get-os-distro.sh",
        "nuget": "/somedir/nuget.exe"
    },
    "checkPath": {
        "/somedir/currdir/externals/get-os-distro.sh": true
    }
};

tr.registerMock('./utilities', {
    getDirname: function () {
        return "/somedir/currdir";
    },
    setFileAttribute: function (file, mode) {
        console.log("Changing attribute for file " + file + " to " + mode);
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
