import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'installprovprofile.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('provisioningProfileLocation', 'sourceRepository');
tr.setInput('provProfileSourceRepository', '/build/source/doesnotexist.moblieprovision');

process.env['AGENT_VERSION'] = '2.116.0';
process.env['HOME'] = '/users/test';

let secureFileHelperMock = require('securefiles-common/securefiles-common-mock');
tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    }
});

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "exist": { 
        "/build/source/doesnotexist.moblieprovision": false
    }
};
tr.setAnswers(a);

tr.run();

