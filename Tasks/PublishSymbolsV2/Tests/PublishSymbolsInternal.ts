import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

import { ClientToolMockHelper } from './PublishSymbolsMockHelper';
let taskPath = path.join(__dirname, '..', 'clienttoolmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: ClientToolMockHelper = new ClientToolMockHelper(tmr);

tmr.setInput('command', 'publish');
tmr.setInput('SourceFolder', 'c:\\temp');
tmr.setInput('ArtifactServices.Symbol.AccountName', 'example');
tmr.setInput('ArtifactServices.Symbol.PAT', 'token');
tmr.setInput('System.TeamProject', 'testpublishsymbol');
tmr.setInput('Build.DefinitionName', 'testpublishsymbolbuild');
tmr.setInput('Build.BuildNumber', '2021.11.30');
tmr.setInput('Build.BuildId', '1');
tmr.setInput('CLIENTTOOL_FILE_PATH', 'c:\\mock\\location\\symbol.exe');

umh.mockClientToolCommand("publish", "testpublishsymbol/testpublishsymbolbuild/2021.11.30/1/96acb404-71d9-4c3a-9214-13b42ab8229f", "c:\\temp", '3650', {
    "code": 0,
    "stdout": "Symbol.exe output",
    "stderr": ""
});

tmr.run();