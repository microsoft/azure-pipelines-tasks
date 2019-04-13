import * as os from 'os';
import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as ma from 'azure-pipelines-task-lib/mock-answer';

let taskPath = path.join(__dirname, '..', 'useruby.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('version', '3.x');

// `getVariable` is not supported by `TaskLibAnswers`
process.env['AGENT_TOOLSDIRECTORY'] = '$(Agent.ToolsDirectory)';

tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: () => null,
    findLocalToolVersions: () => ['2.7.13']
});

tr.registerMock('os', {
    type: () => { return 'linux'; },
    EOL: os.EOL,
    arch: os.arch
});

tr.setAnswers(<ma.TaskLibAnswers> {
});

tr.run();
