import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'postxcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// Xcode task run tests
tr.setInput('actions', 'test');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/project.xcworkspace');
tr.setInput('scheme', 'testScheme');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('destinationPlatformOption', 'default');
tr.setInput('destinationPlatform', '');
tr.setInput('destinationTypeOption', 'simulators');
tr.setInput('destinationSimulators', 'iPhone 7');
tr.setInput('destinationDevices', '');
tr.setInput('useXcpretty', 'true');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('cwd', '/home/build');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/users/test"
    },
    "which": {
        "xcpretty": ""
    },
    "findMatch": {
        "/home/build/**/build/reports/junit.xml": [
            "/home/build/testbuild1/build/reports/junit.xml"
        ]
    }
};
tr.setAnswers(a);

os.platform = () => {
    return 'darwin';
}
tr.registerMock('os', os);

tr.run();

