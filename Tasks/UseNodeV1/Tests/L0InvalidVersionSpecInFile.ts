import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionFilePath', '.node-version');

tmr.registerMock('fs', {
  readFileSync: function (filePath) {
    if (filePath === '.node-version') {
      return 'InvalidFromFile';
    }

    return 'Unexpected file path: ' + filePath;
  }
});

tmr.run();
