import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

import { UniversalMockHelper } from './UniversalMockHelper';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: UniversalMockHelper = new UniversalMockHelper(tmr);

tmr.setInput('command', 'publish');
tmr.setInput('publishDirectory', 'c:\\packages');
tmr.setInput('internalOrExternalPublish', 'internal');
tmr.setInput('feedListPublish', 'TestFeed');
tmr.setInput('packageListPublish', 'TestPackage');
tmr.setInput('versionPublishSelector', 'custom');
tmr.setInput('versionPublish', '1.0.0');
tmr.setInput('packagePublishDescription', 'Test package');

// Mock publish command with description parameter
const artifactToolCmd = 'c:\\mock\\location\\ArtifactTool.exe';
umh.answers.exec[`${artifactToolCmd} universal publish --feed TestFeed --service https://example.visualstudio.com/defaultcollection --package-name TestPackage --package-version 1.0.0 --path c:\\packages --patvar UNIVERSAL_PUBLISH_PAT --verbosity verbose --description Test package`] = {
    "code": 0,
    "stdout": "Package published successfully",
    "stderr": ""
};

tmr.run();
