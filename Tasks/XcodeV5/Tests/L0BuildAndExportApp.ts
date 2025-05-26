import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'build');
tr.setInput('configuration', 'Release');
tr.setInput('sdk', 'iphoneos');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'MyScheme');
tr.setInput('packageApp', 'true');
tr.setInput('signingOption', 'nosign');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');

process.env['AGENT_VERSION'] =  '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";
process.env['HOME'] = '/users/test';

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
  "which": {
    "xcodebuild": "/home/bin/xcodebuild"
  },
  "checkPath" : {
    "/home/bin/xcodebuild": true
  },
  "exist": {
    "/user/build/cert.p12": true
  },
  "getVariable": {
    "build.sourcesDirectory": "/user/build",
    "HOME": "/users/test"
  },
  "findMatch": {
    "**/*.xcodeproj/*.xcworkspace": [
      "/user/build/MyApp.xcodeproj/project.xcworkspace"
    ]
  },
  "exec": {
    "/home/bin/xcodebuild -version": {
      "code": 0,
      "stdout": "Xcode 12.4"
    },
    // This is the initial build command that should NOT be called
    "/home/bin/xcodebuild -sdk iphoneos -configuration Release -workspace /user/build/MyApp.xcodeproj/project.xcworkspace -scheme MyScheme build CODE_SIGNING_ALLOWED=NO": {
      "code": 0,
      "stdout": "Should not run"
    },
    // This is the archive command that SHOULD be called
    "/home/bin/xcodebuild -workspace /user/build/MyApp.xcodeproj/project.xcworkspace -scheme MyScheme archive -sdk iphoneos -configuration Release -archivePath /user/build/MyScheme.xcarchive CODE_SIGNING_ALLOWED=NO": {
      "code": 0,
      "stdout": "archive output"
    }
  }
};
tr.setAnswers(a);

tr.run();