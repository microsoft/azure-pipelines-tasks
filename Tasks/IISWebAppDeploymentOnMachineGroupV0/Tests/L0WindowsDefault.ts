import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { EventEmitter } from 'events';

let taskPath = path.join(__dirname, '..', 'deployiiswebapp.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('WebSiteName','mytestwebsite');
tr.setInput('VirtualApplication', 'mytestapp');
tr.setInput('Package', 'webAppPkg.zip');

process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";

// provide answers for task mock

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "msdeploy": "msdeploy"
    },
    "stats": {
    	"webAppPkg.zip": {
    		"isFile": true
    	}
    },
    "checkPath": {
        "msdeploy": true
    },
    "exec": {
        "msdeploy -verb:sync -source:package='webAppPkg.zip' -dest:auto -setParam:name='IIS Web Application Name',value='mytestwebsite/mytestapp' -enableRule:DoNotDeleteRule":{
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "msdeploy -verb:getParameters -source:package=\'webAppPkg.zip\'": {
            "code": 0,
            "stdout": "Executed Successfully"
        }
    },	
    "exist": {
    	"webAppPkg.zip": true
    }
};

import mockTask = require('azure-pipelines-task-lib/mock-task');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common/msdeployutility.js');
tr.registerMock('./ziputility', {
    getArchivedEntries: function(webDeployPkg) {
        return {
            "entries": [
                "systemInfo.xml",
                "parameters.xml"
            ]
        };
    }
});
tr.registerMock('./msdeployutility.js', {
    getMSDeployCmdArgs : msDeployUtility.getMSDeployCmdArgs,
    getMSDeployFullPath : function() {
        var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
        return msDeployFullPath;
    }
});

var fs = require('fs');
tr.registerMock('fs', {
    ...fs,
    createWriteStream: function (filePath, options) {
        return { 
            "isWriteStreamObj": true,
            "on": (event) => {
                console.log("event: " + event + " has been triggered");
            },
            "end" : () => { return true; }
        };
    },
    ReadStream: fs.ReadStream,
    WriteStream: fs.WriteStream,
    openSync: function (fd, options) {
        return true;
    },
    closeSync: function (fd) {
        return true;
    },
    fsyncSync: function(fd) {
        return true;
    }
});

if (process.env['DISTRIBUTEDTASK_TASKS_SECUREMSDEPLOYCOMMANDEXECUTION'] === 'true' &&
    process.env['DISTRIBUTEDTASK_TASKS_WEBDEPLOYMENTCOMPATIBILITYFIXENABLED'] === 'true') {
    const childProcess = require('child_process');
    tr.registerMock('child_process', {
        ...childProcess,
        spawn: function (toolPath, args, options) {
            console.log('secure-msdeploy-spawn:' + toolPath);
            console.log('secure-msdeploy-options:' + JSON.stringify(options));

            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            process.nextTick(() => child.emit('close', 0, null));
            return child;
        },
        spawnSync: function () {
            console.log('8.3 fallback invoked');
            throw new Error('8.3 fallback must not be used');
        }
    });

    tr.registerMock('path', {
        ...path,
        join: function (...parts: string[]) {
            if (parts[parts.length - 1] === 'msdeploy.exe' && parts.indexOf('MSDeploy3.6') >= 0) {
                return 'C:\\Program Files\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe';
            }
            return path.join(...parts);
        }
    });
}

tr.setAnswers(a);
tr.run();
