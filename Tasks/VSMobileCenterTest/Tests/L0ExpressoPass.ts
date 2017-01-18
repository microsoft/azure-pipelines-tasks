
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'vsmobilecentertest.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('credsType', 'serviceEndpoint');
tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('devices', '1234abcd');
tmr.setInput('series', 'master');
tmr.setInput('dsymDir', '/path/to/dsym');
tmr.setInput('locale', 'nl_NL');
tmr.setInput('artifactsDir', '/path/to/artifactsDir');
tmr.setInput('framework', 'expresso');
tmr.setInput('expressoBuildDir', '/path/to/expresso_build_dir');
tmr.setInput('expressoTestApkPath', '/path/to/expresso_test_apk');
tmr.setInput('debug', 'true');
tmr.setInput('cliLocationOverride', '/path/to/mobile-center');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "/test/path/to/my.ipa": true,
        "/path/to/expresso_test_apk": true,
        "/path/to/mobile-center": true
    },
    "exec" : {
        "/path/to/mobile-center test prepare expresso --artifacts-dir /path/to/artifactsDir --build-dir /path/to/expresso_build_dir --test-apk-path /path/to/expresso_test_apk --debug --quiet": {
            "code": 0,
            "stdout": "success",
            "stderr": ""
        },
        "/path/to/mobile-center test run manifest --manifest-path /path/to/artifactsDir/manifest.json --app-path /test/path/to/my.ipa --app testuser/testapp --devices 1234abcd --test-series master --dsym-dir /path/to/dsym --locale nl_NL --debug --quiet --token mytoken123": {
            "code": 0,
            "stdout": "success",
            "stderr": ""
        }
    }
};
tmr.setAnswers(a);

tmr.registerMock('./utils.js', {
    resolveSinglePath: function(s) {
        return s ? s : null;
    },
    checkAndFixFilePath: function(p, name) {
        return p;
    }
});

path.join = function(p, s) {
    return `${p}/${s}`;
}
tmr.registerMock('path', path);

tmr.run();

