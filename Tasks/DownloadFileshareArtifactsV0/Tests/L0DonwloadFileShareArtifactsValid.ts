import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as models from 'artifact-engine/Models';

const taskPath = path.join(__dirname, '..', 'main.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('downloadPath', '/usr/bin');
tr.setInput('fileSharePath', '/usr/bin/sample');
tr.setInput('artifactName', 'foo');

const fsAnswers = {
  existsSync: function (filePath: string) {
      return true;
  }
};
tr.registerMock('fs', fsAnswers);

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
