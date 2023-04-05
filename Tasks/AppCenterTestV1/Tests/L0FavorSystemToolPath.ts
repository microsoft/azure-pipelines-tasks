
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'appcentertest.js');
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
        "/system/path/to/appcenter": true
    },
    "exec" : {
        "/system/path/to/appcenter login -u MyUsername -p MyPassword --quiet" : {
            "code": 128,
            "stdout": "success",
            "stderr": ""
        }
    },
    "exist": {
        "/system/path/to/appcenter": true
    },
    "which": {
        "appcenter": "/system/path/to/appcenter"
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

