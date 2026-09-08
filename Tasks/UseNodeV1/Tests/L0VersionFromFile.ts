import * as fs from 'fs';
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSource', 'fromFile');
tmr.setInput('version', '10.x');
tmr.setInput('versionFilePath', '.node-version');

tmr.registerMock('fs', {
  ...fs,
  readFileSync: function (filePath, options) {
    if (filePath === '.node-version') {
      return '20.11.1\r\n';
    }

    return fs.readFileSync(filePath, options);
  }
});

tmr.registerMock('./installer', {
  getNode: async function (version: string) {
    if (version !== '20.11.1') {
      throw new Error(`Expected version 20.11.1, got ${version}`);
    }

    console.log(`VERSION_FROM_FILE ${version}`);
  },
  normalizeMirrorUrl: function (url: string) {
    return url;
  }
});

tmr.run();
