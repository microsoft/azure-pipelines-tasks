import * as os from 'os';
import * as path from 'path';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as ma from 'vsts-task-lib/mock-answer';

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('versionSpec', '3.x');
tr.setInput('addToPath', 'false');

tr.registerMock('vsts-task-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['2.7.13']
});

tr.registerMock('os', {
    type: () => { return 'linux'; },
    EOL: os.EOL
});

tr.setAnswers(<ma.TaskLibAnswers> {
});

tr.run();

