import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('versionSpec', '2.4');
tr.setInput('addToPath', 'true');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    
};
tr.setAnswers(a);

tr.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => path.join('/', 'Ruby', '2.4.4'),
    prependPath: (s: string) => {
        console.log('##vso[task.prependpath]' + s);
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
    return 'win32';
}
tr.registerMock('os', os);

tr.run();

