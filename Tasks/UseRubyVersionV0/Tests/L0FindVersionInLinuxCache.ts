import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'userubyversion.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('versionSpec', '2.5');
tr.setInput('addToPath', 'false');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    
};
tr.setAnswers(a);

tr.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => path.join('/', 'Ruby', '2.5.4'),
    prependPath: (s: string) => {
         s + ':';
    }
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

