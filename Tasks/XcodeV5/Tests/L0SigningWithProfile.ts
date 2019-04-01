
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('actions', 'build');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'fun');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'manual');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', 'testuuid');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('publishJUnitResults', 'false');

process.env['AGENT_VERSION'] =  '2.122.0';
process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";
process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
  "which": {
    "xcodebuild": "/home/bin/xcodebuild",
    "security": "/usr/bin/security",
    "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy"
  },
  "checkPath" : {
    "/home/bin/xcodebuild": true,
    "/usr/bin/security": true,
    "/usr/libexec/PlistBuddy": true
  },
  "exist": {
    "/user/build/cert.p12": true,
    "/user/build/testuuid.mobileprovision": true
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
    "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER=": {
      "code": 0,
      "stdout": "xcodebuild output here"
    },
    "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE= PROVISIONING_PROFILE_SPECIFIER=": {
      "code": 0,
      "stdout": "xcodebuild output here"
    },
    "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER=": {
      "code": 0,
      "stdout": "xcodebuild output here"
    },
    "/usr/bin/security cms -D -i /user/build/testuuid.mobileprovision": {
      "code": 0,
      "stdout": "prov profile details here"
    },
    "/usr/libexec/PlistBuddy -c Print UUID _xcodetasktmp.plist": {
      "code": 0,
      "stdout": "testuuid"
    }
  }
};
tr.setAnswers(a);

tr.run();

