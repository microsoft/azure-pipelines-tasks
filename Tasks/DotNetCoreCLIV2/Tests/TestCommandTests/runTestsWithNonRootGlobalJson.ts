
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

/**
 * Inputs
 */
nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'test');
tmr.setInput('projects', 'src\\temp.csproj');
tmr.setInput('publishTestResults', 'false'); // keep false to avoid auto --logger/--results-directory
tmr.setInput('workingDirectory', 'src');

/**
 * Make repo root deterministic so ancestor search (findGlobalJsonFile) behaves consistently.
 * If your harness reads via tl.getVariable, env vars are enough for L0.
 */
process.env['BUILD_SOURCESDIRECTORY'] = 'c:\\agent\\home\\directory\\sources';
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = 'c:\\agent\\home\\directory\\sources';

const dotnet = 'c:\\path\\dotnet.exe';
const proj   = 'c:\\agent\\home\\directory\\sources\\src\\temp.csproj';

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
  osType: {},
  checkPath: {
    [proj]: true,
    [dotnet]: true
  },
  which: {
    'dotnet': dotnet
  },

  /**
   * EXEC ANSWERS
   * Expand to cover:
   *  - with/without --project
   *  - quoted path variants
   *  - optional flags the task may append (verbosity/configuration)
   * This ensures the mock returns stdout ("dotnet output") for the actual command.
   */
  exec: {
    // Base forms
    [`${dotnet} test ${proj}`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project ${proj}`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },

    // Quoted variants (ToolRunner may quote project path)
    [`${dotnet} test "${proj}"`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project "${proj}"`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },

    // Verbosity (some paths add this)
    [`${dotnet} test ${proj} --verbosity normal`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project ${proj} --verbosity normal`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test "${proj}" --verbosity normal`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project "${proj}" --verbosity normal`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },

    // Configuration (some paths add this)
    [`${dotnet} test ${proj} --configuration Release`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project ${proj} --configuration Release`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test "${proj}" --configuration Release`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    },
    [`${dotnet} test --project "${proj}" --configuration Release`]: {
      code: 0, stdout: 'dotnet output', stderr: ''
    }
  },

  /**
   * File-system answers
   */
  exist: {
    'D:\\src\\github\\vsts-tasks\\Tests\\Nuget': true,
    'c:\\agent\\home\\directory\\sources\\src\\global.json': true
  },
  stats: {
    [proj]: { isFile: true }
  },
  findMatch: {
    'src\\temp.csproj': [proj]
  }
};

nmh.setAnswers(a);

/**
 * NuGet mocks
 */
nmh.registerNugetUtilityMock([proj]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

/**
 * Mock fs to return MTP runner from non-root global.json
 */
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(filePath: string, options: any) {
  switch (filePath) {
    case 'c:\\agent\\home\\directory\\sources\\src\\global.json':
      return '{"test":{"runner":"Microsoft.Testing.Platform"}}';
    default:
      return fs.readFileSync(filePath, options);
  }
};
tmr.registerMock('fs', fsClone);

/**
 * Mock path.resolve so relative paths resolve under repo root
 */
let pathClone = Object.assign({}, path);
pathClone.resolve = function (...paths: string[]): string {
  if (paths.length === 1) {
    const p = paths[0];
    if (p.startsWith('c:') || p.startsWith('/')) {
      return p;
    }
    return 'c:\\agent\\home\\directory\\sources\\' + p;
  }
  return path.resolve(...paths);
};
tmr.registerMock('path', pathClone);

/**
 * Run
 */
tmr.run();
