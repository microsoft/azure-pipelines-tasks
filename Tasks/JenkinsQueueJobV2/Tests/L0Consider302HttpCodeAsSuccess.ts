import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'jenkinsqueuejobtask.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('serverEndpoint', 'ID1');
tr.setInput('jobName', 'SomeJobName');
tr.setInput('captureConsole', 'true');
tr.setInput('capturePipeline', 'true');
tr.setInput('parameterizedJob', 'false');
tr.setInput('considerCode302AsSuccess', 'true');

// provide answers for task mock
const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath': {
        'gradlew': true,
        'gradlew.bat': true
    },
    'osType': {
        'osType': 'Windows'
    }
};
tr.setAnswers(a);

const requestClone: any = {};
requestClone.get = function (params, callback: (err: any, httpResponse: any, body: string) => void) {
    // mock url for getCrumb request  
    if (params.url === "bogusURL/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,%22:%22,//crumb)") {
        const body: string = "fakeCrumpBody";
        const httpResponse: any = {}
        httpResponse.statusCode = 200;

        callback(null, httpResponse, body);
    }

    return {
        auth: function (username: string, password: string, sendImmediately: boolean) { }
    };
};

requestClone.post = function (params, callback: (err: any, httpResponse: any, body: string) => void) {
    const bodyObj = {
        created: 'fakeCreatedUrl'
    };
    const httpResponse: any = {}
    httpResponse.statusCode = 302;

    callback(null, httpResponse, JSON.stringify(bodyObj));

    return {
        auth: function (username: string, password: string, sendImmediately: boolean) { }
    };
};

tr.registerMock('request', requestClone);

tr.run();
