
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'appcentertest.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('enablePrepare', 'true');
tmr.setInput('enableRun', 'true');
tmr.setInput('credsType', 'serviceEndpoint');
tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', '/test/path/to/my.ipa');
tmr.setInput('devices', '1234abcd');
tmr.setInput('series', 'master');
tmr.setInput('dsymDir', '/path/to/dsym');
tmr.setInput('locale', 'nl_NL');
tmr.setInput('artifactsDir', '/path/to/artifactsDir');
tmr.setInput('framework', 'calabash');
tmr.setInput('calabashProjectDir', '/path/to/project');
tmr.setInput('calabashConfigFile', '/path/to/configfile');
tmr.setInput('calabashProfile', 'myProfile');
tmr.setInput('signInfo', 'SignInfo');
tmr.setInput('async', 'true');
tmr.setInput('runOpts', '--myRunOpts abc');
tmr.setInput('cliLocationOverride', '/path/to/appcenter');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "/test/path/to/my.ipa": true,
        "/path/to/appcenter": true
    },
    "exec" : {
        "/path/to/appcenter test prepare calabash --artifacts-dir /path/to/artifactsDir --app-path /test/path/to/my.ipa --project-dir /path/to/project --sign-info SignInfo --config-path /path/to/configfile --profile myProfile --quiet": {
            "code": 0,
            "stdout": "success",
            "stderr": ""
        },
        "/path/to/appcenter test run manifest --manifest-path /path/to/artifactsDir/manifest.json --app-path /test/path/to/my.ipa --app testuser/testapp --devices 1234abcd --test-series master --dsym-dir /path/to/dsym --async --locale nl_NL --myRunOpts abc --quiet --token mytoken123": {
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

