import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.registerMock('./installer', {
  getNode: async function () {
    throw new Error('Node should not be installed when no version is supplied');
  },
  normalizeMirrorUrl: function (url: string) {
    return url;
  }
});

tmr.run();
