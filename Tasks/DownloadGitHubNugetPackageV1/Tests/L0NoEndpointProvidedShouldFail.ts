import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as ma from 'azure-pipelines-task-lib/mock-answer';
const nock = require('nock');

const taskPath = path.join(__dirname, '..', 'dotnetrestore.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('packageName', 'test/test');
tr.setInput('version', '1.0');

nock('https://api.github.com')
  .get('/user')
  .reply(200, {
    body: {
      invalidField: 1
    }
  });

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getEndpointAuthorization = function (id: string, key: string, optional: boolean) {
  return {};
}

tlClone.getEndpointAuthorizationScheme = function (id: string, key: string, optional: boolean) {
  return undefined;
}

tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
  "osType": {
      "Windows": "WindowsNT"
  }
};
tr.setAnswers(a);

tr.run();