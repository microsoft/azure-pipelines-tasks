
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '/user/build');
tr.setInput('scheme', '');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '-project test.xcodeproj');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('publishJUnitResults', 'false');

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support
process.env['AGENT_VERSION'] =  '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild"
    },
    "checkPath" : {
        "/home/bin/xcodebuild": true
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
        "HOME": "/users/test",
        "agent.version": "2.122.0"
    },
    "findMatch": {
        "/user/build": [
          "/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app"
        ]
    },
    "exec": {
          "/home/bin/xcodebuild -version": {
          "code": 0,
          "stdout": "Xcode 6.4"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) build -project test.xcodeproj": {
            "code": 0,
            "stdout": "xcodebuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();

