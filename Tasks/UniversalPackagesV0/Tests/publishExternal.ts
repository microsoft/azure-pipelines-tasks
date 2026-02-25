import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';

import { UniversalMockHelper } from './UniversalMockHelper';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: UniversalMockHelper = new UniversalMockHelper(tmr);

tmr.setInput('command', 'publish');
tmr.setInput('publishDirectory', 'c:\\packages');
tmr.setInput('internalOrExternalPublish', 'external');
tmr.setInput('externalEndpoints', 'externalFeed');
tmr.setInput('feedPublishExternal', 'TestFeed');
tmr.setInput('packagePublishExternal', 'TestPackage');
tmr.setInput('versionPublishSelector', 'custom');
tmr.setInput('versionPublish', '1.0.0');
tmr.setInput('packagePublishDescription', 'Test package for external feed');

process.env['ENDPOINT_URL_externalFeed'] = 'https://external.pkgs.visualstudio.com/_packaging/TestFeed';
process.env['ENDPOINT_AUTH_externalFeed'] = JSON.stringify({
    parameters: {
        apitoken: 'external_token'
    },
    scheme: 'Token'
});

pkgMock.registerLocationHelpersMock(tmr);

// Mock publish command with description parameter
const artifactToolCmd = 'c:\\mock\\location\\ArtifactTool.exe';
umh.answers.exec[`${artifactToolCmd} universal publish --feed TestFeed --service https://external.pkgs.visualstudio.com/_packaging/TestFeed --package-name TestPackage --package-version 1.0.0 --path c:\\packages --patvar UNIVERSAL_PUBLISH_PAT --verbosity verbose --description Test package for external feed`] = {
    "code": 0,
    "stdout": "Package published to external feed",
    "stderr": ""
};

tmr.run();
