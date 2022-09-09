import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { registerMockedFsLib, registerMockedTaskLib, registerMockedToolLib, registerMockedToolRunner } from './OpenPolicyAgentInstallerTestHelper';

const taskPath = path.join(__dirname, '..', 'src', 'opatoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

//mocking taskLib
registerMockedTaskLib(tr);

//simple mock for ToolRunner class
registerMockedToolRunner(tr);

//mocking fs methods
registerMockedFsLib(tr);

//mocking task lib methods
registerMockedToolLib(tr);

tr.run();