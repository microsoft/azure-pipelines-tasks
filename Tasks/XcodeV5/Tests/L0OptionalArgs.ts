
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'clean build');
tr.setInput('configuration', 'Release');
tr.setInput('sdk', 'iphone');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'fun');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '-exportArchive -exportPath /user/build/output/iphone/release');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'specifyPath');
tr.setInput('xcodeDeveloperDir', '/Applications/Xcode5');
tr.setInput('publishJUnitResults', 'false');

process.env['AGENT_VERSION'] =  '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";
process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
  "which": {
    "xcodebuild": "/home/bin/xcodebuild"
  },
  "checkPath" : {
    "/home/bin/xcodebuild": true
  },
  "getVariable": {
    "build.sourcesDirectory": "/user/build",
    "HOME": "/users/test"
  },
  "findMatch": {
    "**/*.xcodeproj/*.xcworkspace": [
      "/user/build/fun.xcodeproj/project.xcworkspace"
    ]
  },
  "exec": {
    "/home/bin/xcodebuild -version": {
      "code": 0,
      "stdout": "Xcode 7.3.1"
    },
    "/home/bin/xcodebuild -sdk iphone -configuration Release -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun clean build -exportArchive -exportPath /user/build/output/iphone/release": {
      "code": 0,
      "stdout": "xcodebuild output here"
    }
  }
};
tr.setAnswers(a);

tr.run();

