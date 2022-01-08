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
tmr.setInput('Build.UniqueId', '8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5');
tmr.setInput('CLIENTTOOL_FILE_PATH', 'mock/location/symbol.exe');

umh.mockClientToolCommand("publish", "testpublishsymbol/testpublishsymbolbuild/2021.11.30/1/8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5", "c:\\temp", '3650', {
    "code": 0,
    "stdout": "Symbol.exe output",
    "stderr": ""
});

tmr.run();