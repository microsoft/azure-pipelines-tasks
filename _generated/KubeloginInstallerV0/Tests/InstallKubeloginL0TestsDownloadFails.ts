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
      platform: 'win-amd64',
      name: 'releaseName',
      releaseUrl: 'releaseUrl',
      checksumUrl: 'sha256Url'
    };
  },
  downloadKubeloginRelease: function() {
      throw new Error(taskLib.loc('Info_DownloadingFailed', 'Failed to download a zip'));
  },
  getKubeloginPath: utils.getKubeloginPath,
  isLatestVersion: utils.isLatestVersion,
  resolvePlatform: utils.resolvePlatform,
  unzipRelease: utils.unzipRelease,
});

initTaskTests(taskLib);
setAnswears(tr);
registerMockedToolRunner(tr);
registerMockedToolLibTools(tr, true);

tr.setInput('kubeloginVersion', 'latest');

tr.run();
