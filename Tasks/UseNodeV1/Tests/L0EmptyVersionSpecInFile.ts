import * as fs from 'fs';
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const fileContents = process.env['__versionFileContents__'] === 'empty' ? '' : ' \r\n ';

tmr.setInput('versionSource', 'fromFile');
tmr.setInput('version', '10.x');
tmr.setInput('versionFilePath', '.node-version');

tmr.registerMock('fs', {
  ...fs,
  readFileSync: function (filePath, options) {
    if (filePath === '.node-version') {
      return fileContents;
    }

    return fs.readFileSync(filePath, options);
  }
});

tmr.run();
