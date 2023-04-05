import * as path from 'path';

import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as MockToolRunner from 'azure-pipelines-task-lib/mock-toolrunner';

import { goodAnswers } from './goodAnswers';

const taskPath: string = path.join(__dirname, '..', 'publishbuildartifacts.js');
const taskRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('PathtoPublish', '/bin/release/file');
taskRunner.setInput('ArtifactName', 'drop');
taskRunner.setInput('ArtifactType', 'Container');
taskRunner.setInput('StoreAsTar', 'true');

process.env['AGENT_TEMPDIRECTORY'] = process.cwd();

taskRunner.setAnswers(goodAnswers);

taskRunner.registerMock('azure-pipelines-task-lib/toolrunner', MockToolRunner);

const pathClone = Object.assign({}, path);

pathClone.basename = function(inputPath) {
  if (inputPath === '/bin/release/file') {
    return 'file';
  }

  return path.basename(inputPath);
};

pathClone.dirname = function(inputPath) {
  if (inputPath === '/bin/release/file') {
    return '/bin/release';
  }

  return path.dirname(inputPath);
};

taskRunner.registerMock('path', pathClone);

taskRunner.registerMock('os', {
  platform() {
    return 'linux';
  }
});

taskRunner.run();
