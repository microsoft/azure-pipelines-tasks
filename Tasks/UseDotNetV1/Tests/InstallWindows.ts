import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import auth = require('packaging-common/nuget/Authentication');

import { chmodSync } from 'fs';

let taskPath = path.join(__dirname, '..', 'usedotnet.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'runtime');
tr.setInput("version", "1.0.4");
tr.setInput("proxy", process.env["__proxy__"] || 'false');
if (process.env["__auth__"]) {
    tr.setInput("auth", process.env["__auth__"]);
}
tr.setInput("nuGetFeedType", process.env["__nuGetFeedType__"] || 'internal');

process.env["AGENT_TOOLSDIRECTORY"] = "C:\\agent\\_tools";
process.env["AGENT_PROXYURL"] = "https://proxy.com";
process.env["AGENT_PROXYUSERNAME"] = "username";
process.env["AGENT_PROXYPASSWORD"] = "password";

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
        "C:\\somedir\\nuget.exe config --set http_proxy=https://proxy.com": {
            "code": 0,
            "stdout": "Set proxy url" + os.EOL
        },
        "C:\\somedir\\nuget.exe config --set http_proxy.user=username": {
            "code": 0,
            "stdout": "Set proxy username" + os.EOL
        },
        "C:\\somedir\\nuget.exe config --set http_proxy.password=password": {
            "code": 0,
            "stdout": "Set proxy password" + os.EOL
        },
        "C:\\somedir\\nuget.exe sources Add -Name myAuth -Source registryUrl -NonInteractive": {
            "code": 0,
            "stdout": "Set internal auth" + os.EOL
        },
        "C:\\somedir\\nuget.exe sources Add -Name myAuth -Source feed.com -NonInteractive": {
            "code": 0,
            "stdout": "Set external auth" + os.EOL
        },
        "C:\\somedir\\nuget.exe setapikey VSTS -Source registryUrl -NonInteractive": {
            "code": 0,
            "stdout": "Set internal api key" + os.EOL
        },
        "C:\\somedir\\nuget.exe setapikey RequiredApiKey -Source feed.com -NonInteractive": {
            "code": 0,
            "stdout": "Set external api key" + os.EOL
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
    getCurrentDir: function () {
        return "C:\\currDir";
    },
    setFileAttribute: function (file, mode) {
        chmodSync(file, mode);
    }
});

tr.registerMock('packaging-common/nuget/CommandHelper', {
    GetExternalAuthInfoArray: function(endpoint: string) {
        if (endpoint === 'externalEndpoint') {
            const myEndpoint = {packageSource: {feedUri: 'feed.com'},
                                authType: auth.ExternalAuthType.Token};
            return [myEndpoint];
        }
        return null;
    }
});

tr.registerMock('packaging-common/nuget/Utility', {
    getNuGetFeedRegistryUrl: async function(packagingCollectionUrl: string, feedId: string, nuGetVersion: any, accessToken?: string, useSession?: boolean) {
        if (packagingCollectionUrl === 'defaultUri' && feedId === process.env["__auth__"] && nuGetVersion == null && accessToken === 'accessToken' && useSession) {
            return 'registryUrl';
        }
        return null;
    }
});

tr.registerMock('packaging-common/locationUtilities', {
    ProtocolType: {NuGet: 0},
    getPackagingUris: async function(type: number) {
        if (type === 0) {
            return {PackagingUris: ['defaultUri'], DefaultPackagingUri: 'defaultUri'}
        }
        return null;
    },
    getSystemAccessToken: function() {
        return 'accessToken';
    }
});

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tool-lib/tool', require('./mock_node_modules/tool'));
tr.registerMock('./releasesfetcher', require("./mock_node_modules/releasesfetcher"));
tr.run();