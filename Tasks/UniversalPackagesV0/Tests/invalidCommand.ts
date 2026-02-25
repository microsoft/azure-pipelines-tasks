import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

import { UniversalMockHelper } from './UniversalMockHelper';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: UniversalMockHelper = new UniversalMockHelper(tmr);

tmr.setInput('command', 'invalid');
tmr.setInput('publishDirectory', 'c:\\packages');

tmr.run();
