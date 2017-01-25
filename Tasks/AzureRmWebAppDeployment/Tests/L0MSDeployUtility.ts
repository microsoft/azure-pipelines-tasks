"use strict"
var mockery = require('mockery');

mockery.enable({
    warnOnUnregistered: false
});

var fs = require('fs');
mockery.registerMock('fs', fs);
var tlm = require('vsts-task-lib/mock-task');
mockery.deregisterMock('fs');

process.env['TASK_TEST_TRACE'] = 1;
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] = "DefaultWorkingDirectory";

let a = {
    "which": {
        "msdeploy": "msdeploy"
    },
    "checkPath": {
        "msdeploy": true
    },
    "exec": {
        "msdeploy -verb:getParameters -source:package=\'webAppPkg.zip\'": {
            "code": 0,
            "stdout": "Executed Successfully"
        }
    },
    "rmRF": {
        "DefaultWorkingDirectory\\parameter.xml": {
            "success" : true
        }
    }
};

tlm.setAnswers(a);

mockery.registerMock('vsts-task-lib/task', tlm);

mockery.registerMock('fs', {
    createWriteStream: function (filePath, options) {
        console.log("inside createWriteStream function");
        return {
            "isWriteStreamObj": true,
            "write": function(message) {
                console.log(message);
            }
        }; 
    },
    openSync: function (fd, options) {
        console.log("inside openSync function");
        return true;
    },
    closeSync: function (fd) {
        console.log("inside closeSync function");
        return true;
    },
    fsyncSync: function (fd) {
        console.log("inside fsyncSync function");
        return true;
    },
    readFileSync: function (filePath) {
        console.log("inside readFileSync function");
        return "msdeploy -verb:getParameters -source:package=\'webAppPkg.zip\'\n<output><parameters><a><b></b></a></parameters></output>";
    }
});

var msDeployUtility = require('webdeployment-common/msdeployutility.js');

async function trun() {
    var result = await msDeployUtility.containsParamFile("webAppPkg.zip");
    console.log("the result is: " + result);
}

trun();
