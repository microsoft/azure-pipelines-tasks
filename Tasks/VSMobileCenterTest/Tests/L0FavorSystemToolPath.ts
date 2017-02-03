
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'vsmobilecentertest.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('enablePrepare', 'false');
tmr.setInput('enableRun', 'true');
tmr.setInput('credsType', 'inputs');
tmr.setInput('username', 'MyUsername');
tmr.setInput('password', 'MyPassword');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('devices', '1234abcd');
tmr.setInput('series', 'master');
tmr.setInput('dsymDir', '/path/to/dsym');
tmr.setInput('locale', 'user');
tmr.setInput('userDefinedLocale', 'nc_US');
tmr.setInput('artifactsDir', '/path/to/artifactsDir');
tmr.setInput('framework', 'uitest');
tmr.setInput('uitestBuildDir', '/path/to/uitest_build_dir');
tmr.setInput('prepareOpts', '--myopts');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "/test/path/to/my.ipa": true,
        "/system/path/to/mobile-center": true
    },
    "exec" : {
        "/system/path/to/mobile-center login -u MyUsername -p MyPassword --quiet" : {
            "code": 128,
            "stdout": "success",
            "stderr": ""
        }
    },
    "exist": {
        "/system/path/to/mobile-center": true
    },
    "which": {
        "mobile-center": "/system/path/to/mobile-center"
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

