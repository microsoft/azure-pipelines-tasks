import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as taskLib from 'azure-pipelines-task-lib/task';

import * as utils from '../utils' 
import fs = require('fs');

import {
  initTaskTests,
  setAnswears,
  registerMockedToolRunner,
  registerMockedToolLibTools,
  releasePath
} from './TestHelper';

const taskPath = path.join(__dirname, '..', 'kubelogin.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);


tr.registerMock('./utils', {
  getLatestVersionTag: function() {
    return 'v0.0.28';
  },
  getKubeloginRelease: function() {
    return {
      version: 'v0.0.28',
      platform: utils.resolvePlatform(),
      name: 'releaseName',
      releaseUrl: 'releaseUrl',
      checksumUrl: 'sha256Url'
    };
  },
  downloadKubeloginRelease: function() {
      return releasePath;
  },
  getKubeloginPath: utils.getKubeloginPath,
  isLatestVersion: utils.isLatestVersion,
  resolvePlatform: utils.resolvePlatform,
  unzipRelease: utils.unzipRelease,
});

tr.setInput('kubeloginVersion', 'latest');

initTaskTests(taskLib);
setAnswears(tr);
registerMockedToolRunner(tr);
registerMockedToolLibTools(tr);


tr.run();
