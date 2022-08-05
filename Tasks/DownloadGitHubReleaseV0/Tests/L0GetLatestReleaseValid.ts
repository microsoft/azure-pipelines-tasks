import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as models from 'artifact-engine/Models';

const nock = require('nock');
const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);


tr.setInput('connection', 'connection');
tr.setInput('userRepository', 'userOrg/repoName');
tr.setInput('downloadPath', 'usr/bin');
tr.setInput('defaultVersionType', 'Latest Release');

nock('https://api.github.com')
  .get('/repos/userOrg/repoName/releases/latest')
  .reply(200, {
    id: 1,
    name: "some - name"
  });
  
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getEndpointAuthorizationParameter = function (id: string, key: string, optional: boolean) {
    key = key.toUpperCase();
    if (key == 'ACCESSTOKEN') {
      return 'username';
    }
  
    if (optional) {
      return '';
    }
    throw new Error(`Endpoint auth data not present: ${id}`);
}
tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

tr.registerMock("artifact-engine/Engine", { 
  ArtifactEngine: function() {
      return { 
          processItems: function(A,B,C) {
            return new Promise<models.ArtifactDownloadTicket[]>(function(res, rej) {
              res(null);
            });
          }
      }
  },
  ArtifactEngineOptions: function() {
  }
});

tr.run();