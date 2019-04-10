import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';

let taskPath = path.join(__dirname, '..', 'useruby.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('version', '2.5');

tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: () => path.join('/', 'Ruby', '2.5.4'),
    prependPath: (s: string) => {
        console.log('##vso[task.prependpath]' + s);
    }
});

tr.registerMock('os', {
    type: () => { return 'linux'; },
    EOL: os.EOL,
    arch: os.arch
});

tr.setAnswers(<ma.TaskLibAnswers> {
    "which": {
        "sudo": "sudo"
    },
    "checkPath": {
        "sudo": true,
    },
    "exec": {
       "sudo ln -sf /Ruby/2.5.4/bin/ruby /usr/bin/ruby": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
    },
});

tr.run();
