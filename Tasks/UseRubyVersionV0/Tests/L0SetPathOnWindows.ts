import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tmrm from 'vsts-task-lib/mock-run';

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('versionSpec', '2.4');
tr.setInput('addToPath', 'true');

tr.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => path.join('/', 'Ruby', '2.4.4'),
    prependPath: (s: string) => {
        console.log('##vso[task.prependpath]' + s);
    }
});

tr.registerMock('fs', {
    symlinkSync: () => { },
    unlinkSync: () => { },
    existsSync: () => { return true; },
    statSync: fs.statSync,
    writeFileSync: fs.writeFileSync,
    readFileSync: fs.readFileSync
});

tr.registerMock('os', {
    type: () => { return 'win32'; },
    EOL: os.EOL
});


tr.run();

