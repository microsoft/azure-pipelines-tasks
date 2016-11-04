import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'prcatask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['BUILD_SOURCEBRANCH'] = 'refs/pull/6/master'; //task-lib doesn't support getVariable yet, so we need these
process.env['BUILD_REPOSITORY_ID'] = '00000000-0000-0000-0000-000000000000';
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = '{\"scheme\":\"OAuth\", \"parameters\": {\"AccessToken\": \"foobar\"}}';
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://notanaccount.notvisualstudio.com/DefaultCollection';
process.env['PRCA_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-report.json');

tmr.setInput('messageLimit', '100');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": { // This doesn't work, but when it does the process.env['...'] calls can be removed
        "Build.SourceBranch": "refs/pull/6/master",
        "Build.Repository.Id": "00000000-0000-0000-0000-000000000000",
        "ENDPOINT_AUTH_SYSTEMVSSCONNECTION": "{\"scheme\":\"OAuth\", \"parameters\": {\"AccessToken\": \"foobar\"}}",
        "System.TeamFoundationCollectionUri": "https://notanaccount.notvisualstudio.com/DefaultCollection",
        "PRCA_REPORT_PATH": path.join(__dirname, 'data', 'sonar-report.json')
    },
};
tmr.setAnswers(a);

// if you need to, you can mock a specific module function called in task 
// tmr.registerMock('./taskmod', {
//     sayHello: function() {
//         console.log('Hello Mock!');
//     }
// });

tmr.run();

