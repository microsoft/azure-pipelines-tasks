import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { ClientToolMockHelper } from './PublishSymbolsMockHelper';

let taskPath = path.join(__dirname, '..', 'clienttoolmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let umh: ClientToolMockHelper = new ClientToolMockHelper(tmr);

tmr.setInput('PublishSymbols', 'true');
tmr.setInput('DetailedLog', 'true');
tmr.setInput('SymbolsFolder', 'c:\\temp');
tmr.setInput('SearchPattern', 'pattern/to/files/*')
tmr.setVariableName('SYMBOLTOOL_FILE_PATH', 'mock/location/symbol.exe');

umh.mockClientToolCommand("publish", "testpublishsymbol/testpublishsymbolbuild/2021.11.30/1/8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5", "c:\\temp", '36530', path.join("c:\\agent\\_temp", "ListOfSymbols-8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5.txt"), {
    "code": 0,
    "stdout": "Symbol.exe output",
    "stderr": ""
});

tmr.run();