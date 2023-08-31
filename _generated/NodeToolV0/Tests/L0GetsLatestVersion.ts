import tmrm = require('azure-pipelines-task-lib/mock-run');
import assert = require('assert');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'nodetool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSource', 'spec');
tmr.setInput('versionSpec', '>=12.0.0');
tmr.setInput('checkLatest', 'true');
tmr.setInput('nodejsMirror', 'https://nodejs.org/dist');

//Create tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    isExplicitVersion: function() {
        return false;
    },
    evaluateVersions: function(versions: string[], versionSpec) {
        const invalidVersions = versions.filter(v => !/^\d+\.\d+\.\d+$/.test(v));
        assert(invalidVersions.length === 0, "Invalid versions passed to evaluateVersions");
        return "12.8.0";
    },
    cleanVersion: function(version: string) {
        return version.replace(/^v/i, "");
    },
    findLocalTool: function(toolName, versionSpec) {
        assert(versionSpec === "v12.8.0", "Version returned should begin with 'v'");        
        return "/path/to/node";
    },
    prependPath(toolPath) {
        return;
    }
});

tmr.registerMock('typed-rest-client/RestClient', {
    RestClient: function() {
        return {
            get: async function(url, options) {
                const versions = [
                    {"version":"v12.8.0","date":"2019-08-06","files":["aix-ppc64","headers","linux-arm64","linux-armv7l","linux-ppc64le","linux-s390x","linux-x64","osx-x64-pkg","osx-x64-tar","src","sunos-x64","win-x64-7z","win-x64-exe","win-x64-msi","win-x64-zip","win-x86-7z","win-x86-exe","win-x86-msi","win-x86-zip"],"npm":"6.10.2","v8":"7.5.288.22","uv":"1.30.1","zlib":"1.2.11","openssl":"1.1.1c","modules":"72","lts":false,"security":false},
                    {"version":"v12.7.0","date":"2019-07-23","files":["aix-ppc64","headers","linux-arm64","linux-armv7l","linux-ppc64le","linux-s390x","linux-x64","osx-x64-pkg","osx-x64-tar","src","sunos-x64","win-x64-7z","win-x64-exe","win-x64-msi","win-x64-zip","win-x86-7z","win-x86-exe","win-x86-msi","win-x86-zip"],"npm":"6.10.0","v8":"7.5.288.22","uv":"1.30.1","zlib":"1.2.11","openssl":"1.1.1c","modules":"72","lts":false,"security":false},
                    {"version":"v11.15.0","date":"2019-04-30","files":["aix-ppc64","headers","linux-arm64","linux-armv6l","linux-armv7l","linux-ppc64le","linux-s390x","linux-x64","osx-x64-pkg","osx-x64-tar","src","sunos-x64","win-x64-7z","win-x64-exe","win-x64-msi","win-x64-zip","win-x86-7z","win-x86-exe","win-x86-msi","win-x86-zip"],"npm":"6.7.0","v8":"7.0.276.38","uv":"1.27.0","zlib":"1.2.11","openssl":"1.1.1b","modules":"67","lts":false,"security":false},
                    {"version":"v11.14.0","date":"2019-04-10","files":["aix-ppc64","headers","linux-arm64","linux-armv6l","linux-armv7l","linux-ppc64le","linux-s390x","linux-x64","osx-x64-pkg","osx-x64-tar","src","sunos-x64","win-x64-7z","win-x64-exe","win-x64-msi","win-x64-zip","win-x86-7z","win-x86-exe","win-x86-msi","win-x86-zip"],"npm":"6.7.0","v8":"7.0.276.38","uv":"1.27.0","zlib":"1.2.11","openssl":"1.1.1b","modules":"67","lts":false,"security":false}
                ]

                return {
                    result: versions
                };
            }
        }
    }
});

tmr.run();