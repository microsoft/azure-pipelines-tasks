import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('options', '');
tr.setInput('tasks', 'build');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');
tr.setInput('jdkVersion', '1.5');
tr.setInput('jdkArchitecture', 'x86');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true
    },
    // 'which': {
    //     'xcodebuild': '/home/bin/xcodebuild',
    //     'security': '/usr/bin/security',
    //     '/usr/libexec/PlistBuddy': '/usr/libexec/PlistBuddy',
    //     'rm': '/bin/rm',
    //     'cp': '/bin/cp'
    // },
    // 'checkPath' : {
    //     '/home/bin/xcodebuild': true,
    //     '/usr/bin/security': true,
    //     '/usr/libexec/PlistBuddy': true,
    //     '/bin/rm': true,
    //     '/bin/cp': true
    // },
    // 'filePathSupplied': {
    //     'archivePath': false
    // },
    // 'getVariable': {
    //     'HOME': '/users/test'
    // },
//    'exist': {
//        '/home/gradlew': false
//    },
    // 'stats': {
    //     '/user/build': {
    //         'isFile': false
    //     }
    // },
    // 'glob': {
    //     '**/*.xcodeproj/*.xcworkspace': [
    //         '/user/build/fun.xcodeproj/project.xcworkspace'
    //     ],
    //     '/user/build/output/$(SDK)/$(Configuration)/build.sym/**/*.app': [
    //         '/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app'
    //     ],
    //     '/user/build/**/*.xcarchive': [
    //         '/user/build/testScheme.xcarchive'
    //     ]
    // },
    'exec': {
        'gradlew build': {
            'code': 0,
            'stdout': 'Sample gradle output'
        },
        'gradlew.bat build': {
            'code': 0,
            'stdout': 'Sample gradle output'
        },
        'reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\1.5 /v JavaHome /reg:32': {
            'code': 222,
            'stdout': ''
        }
    //     'gradlew.bat /o /p t i /o /n /s build test deploy': {
    //         'code': 0,
    //         'stdout': 'More sample gradle output'
    //     }
    }
};
tr.setAnswers(a);

tr.run();
