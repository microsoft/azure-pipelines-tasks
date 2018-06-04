import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');
import tool = require('vsts-task-tool-lib/tool');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('versionSpec', '3.x');
tr.setInput('addToPath', 'false');

process.env['AGENT_VERSION'] = '2.116.0';

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    
};
tr.setAnswers(a);

tr.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['2.7.13']
});

fs.symlinkSync = (s) => {
}
fs.unlinkSync = (s) => {
}
fs.existsSync = (s) => {
    return true;
}
tr.registerMock('fs', fs);

os.platform = () => {
    return 'linux';
}
tr.registerMock('os', os);

tr.run();

