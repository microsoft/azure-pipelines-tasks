
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { emit } from 'cluster';
import { emitTelemetry } from '../xcodeutils';

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'test');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'myscheme');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('useXcpretty', 'false');
tr.setInput('publishJUnitResults', 'true');

tr.registerMock('./xcodeutils', {
    getUniqueLogFileName: function (logPrefix: string) {
        return '/build/temp' + logPrefix + '.log';
    },
    emitTelemetry: function(area: string, feature: string, taskSpecificTelemetry: { [key: string]: any; }) {
        console.log('Xcode task telemetry');
    }
});

process.env['AGENT_VERSION'] =  '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";
process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "xcpretty": "/home/bin/xcpretty"
    },
    "checkPath" : {
        "/home/bin/xcodebuild": true,
        "/home/bin/xcpretty": true
    },
    "findMatch": {
        "**/*.xcodeproj/*.xcworkspace": [
            "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "/user/build": [
            "/user/build/build/reports/junit.xml"
        ]
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
        "HOME": "/users/test"
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
            "code": 0,
            "stdout": "Xcode 7.3.1"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme test | /home/bin/xcpretty -r junit --no-color": {
            "code": 0,
            "stdout": "xcodebuild | xcpretty output here"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme test": {
            "code": 0,
            "stdout": "xcodebuild output without xcpretty here"
        }
    }
};
tr.setAnswers(a);

tr.run();

