import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

import { UniversalMockHelper } from './UniversalMockHelper';
let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: UniversalMockHelper = new UniversalMockHelper(tmr);

tmr.setInput('command', 'download');
tmr.setInput('downloadDirectory', 'c:\\temp');
tmr.setInput('internalOrExternalDownload', 'internal');
tmr.setInput('feedListDownload', 'TestFeed');
tmr.setInput('packageListDownload', 'TestPackage');
tmr.setInput('versionListDownload', '1.0.0');

umh.mockUniversalCommand("download", "TestFeed", "TestPackage", "1.0.0", "c:\\temp", {
    "code": 0,
    "stdout": "ArtifactTool.exe output",
    "stderr": ""
});

tmr.run();