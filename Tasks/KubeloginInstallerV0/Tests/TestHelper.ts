import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import Q = require('q');

import * as utils from '../utils'

var process = require('process');

Date.now = () => {
  return 123456;
};

const kubelogin = `kubelogin-${utils.resolvePlatform()}`
const kubelogin_zip = `${kubelogin}.zip`

export const tempDir = path.join(__dirname, 'temp');
export const releasePath = path.join(__dirname, kubelogin_zip);
export const unzipPath = path.join(tempDir, kubelogin);

export const toolPathWin = path.join(tempDir, kubelogin, 'bin', 'windows_amd64', 'kubelogin.exe');
export const toolPathLinux = path.join(tempDir, kubelogin, 'bin', 'linux_amd64', 'kubelogin');
export const toolPathDarwin = path.join(tempDir, kubelogin, 'bin', 'darwin_amd64', 'kubelogin');

export function initTaskTests(taskLib): void {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  taskLib.setVariable('agent.TempDirectory', tempDir);
  taskLib.setVariable('Agent.ToolsDirectory', tempDir);
}

export function setAnswears(tr: tmrm.TaskMockRunner, toolPathVal: boolean = true): void {
  let toolPath = toolPathWin;
  if (process.platform == 'linux') {
    toolPath = toolPathLinux;
  }
  else if (process.platform == 'darwin') {
    toolPath = toolPathDarwin;
  }
  const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    stats: {
      [releasePath]: true,
    },
    exist: {
      [releasePath]: true
    },
    checkPath: {
      [tempDir]: true,
      [toolPathWin]: toolPathVal,
      [toolPathLinux]: toolPathVal,
      [toolPathDarwin]: toolPathVal
    },
    'kubelogin --version': {
      code: 0
    },
    which: {
      kubelogin: toolPath
    }
  };

  tr.setAnswers(a);
}

export function registerMockedToolRunner(tr: tmrm.TaskMockRunner): void {
  const MockToolRunner = function (tool) {
    let _tool;
    let _line;
    let _args;

    this.init = tool => (this._tool = tool);

    this.arg = args => {
      this._args = args;
      return this;
    };

    this.line = val => {
      this._line = val;
      return this;
    };

    this.exec = options => {
      const defer = Q.defer();
      setTimeout(function () {
        defer.resolve(0);
      }, 100);
      return defer.promise;
    };

    this.init(tool);
  };
  tr.registerMockExport('tool', tool => {
    return new MockToolRunner(tool);
  });
}

export function registerMockedToolLibTools(tr: tmrm.TaskMockRunner, processItemsError: boolean = false): void {
  tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function (A, B) {
      return undefined;
    },
    cacheFile: function (A, B, C, D) {
      return undefined;
    },
    cleanVersion: function (A) {
      return A;
    },
    prependPath: function (A) {},
    downloadTool: function(A, B) {
      return new Promise(async (resolve, reject) => {
        if (processItemsError) {
          reject('Failed to download a zip');
        }
        fs.copyFile(path.join(__dirname, kubelogin_zip), releasePath, err => {
          if (err) reject(err);
          resolve(releasePath);
        });
      });
    }
  });
}