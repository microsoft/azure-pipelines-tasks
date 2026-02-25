import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';

import { UniversalMockHelper } from './UniversalMockHelper';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: UniversalMockHelper = new UniversalMockHelper(tmr);

tmr.setInput('command', 'download');
tmr.setInput('downloadDirectory', 'c:\\temp');
tmr.setInput('internalOrExternalDownload', 'external');
tmr.setInput('externalEndpoint', 'externalFeed');
tmr.setInput('feedDownloadExternal', 'TestFeed');
tmr.setInput('packageDownloadExternal', 'TestPackage');
tmr.setInput('versionDownloadExternal', '1.0.0');

// Mock external endpoint
process.env['ENDPOINT_URL_externalFeed'] = 'https://external.pkgs.visualstudio.com/_packaging/TestFeed';
process.env['ENDPOINT_AUTH_externalFeed'] = JSON.stringify({
    parameters: {
        apitoken: 'external_token'
    },
    scheme: 'Token'
});

pkgMock.registerLocationHelpersMock(tmr);

umh.mockUniversalCommand("download", "TestFeed", "TestPackage", "1.0.0", "c:\\temp", {
    "code": 0,
    "stdout": "ArtifactTool.exe output for external",
    "stderr": ""
}, "https://external.pkgs.visualstudio.com/_packaging/TestFeed");

tmr.run();
