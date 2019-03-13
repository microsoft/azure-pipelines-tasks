import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import auth = require('packaging-common/nuget/Authentication');

let taskPath = path.join(__dirname, '..', 'usedotnet.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("packageType", process.env["__package_type__"] || 'sdk');
tr.setInput("version", "1.0.4");
tr.setInput("proxy", process.env["__proxy__"] || 'false');
if (process.env["__auth__"]) {
    tr.setInput("auth", process.env["__auth__"]);
}
tr.setInput("nuGetFeedType", process.env["__nuGetFeedType__"] || 'internal');

process.env["AGENT_TOOLSDIRECTORY"] = "/agent/_tools";
process.env["AGENT_PROXYURL"] = "https://proxy.com";
process.env["AGENT_PROXYUSERNAME"] = "username";
process.env["AGENT_PROXYPASSWORD"] = "password";

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exec": {
        "/somedir/currdir/externals/get-os-distro.sh": {
            "code": 0,
            "stdout": "Primary: linux" + os.EOL
        },
        "/somedir/nuget.exe config --set http_proxy=https://proxy.com": {
            "code": 0,
            "stdout": "Set proxy url" + os.EOL
        },
        "/somedir/nuget.exe config --set http_proxy.user=username": {
            "code": 0,
            "stdout": "Set proxy username" + os.EOL
        },
        "/somedir/nuget.exe config --set http_proxy.password=password": {
            "code": 0,
            "stdout": "Set proxy password" + os.EOL
        },
        "/somedir/nuget.exe sources Add -Name myAuth -Source registryUrl -NonInteractive": {
            "code": 0,
            "stdout": "Set internal auth" + os.EOL
        },
        "/somedir/nuget.exe sources Add -Name myAuth -Source feed.com -NonInteractive": {
            "code": 0,
            "stdout": "Set external auth" + os.EOL
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
    getCurrentDir: function () {
        return "/somedir/currdir";
    },
    setFileAttribute: function (file, mode) {
        console.log("Changing attribute for file " + file + " to " + mode);
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