import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName', 'mytestwebsite');
tr.setInput('Package', 'webAppPkgPattern/**/*.zip');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "stats": {
    	"webAppPkg.zip": {
    		"isFile": true
    	}
    },

    "checkPath": {
        "cmd": true,
        "webAppPkgPattern": true
    },
    "exist": {
    	"webAppPkg.zip": true,
        "webAppPkg": true
    }, 
    "find": {
        "webAppPkgPattern/": ["webAppPkgPattern/webAppPkg1.zip", "webAppPkgPattern/webAppPkg2.zip"]
    },
    "osType": {
        "osType": "Windows"
    }
}

tr.setAnswers(a);
tr.run();