import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

// Mock test for BuildKit explicitly disabled (legacy builder)
let taskPath = path.join(__dirname, '..', '..', 'utils.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set DOCKER_BUILDKIT=0 (legacy builder)
process.env['DOCKER_BUILDKIT'] = '0';

// Mock the task library
tmr.setInput('command', 'build');

// Mock fileutils.writeFileSync to return 0 (empty file)
tmr.registerMock('azure-pipelines-tasks-docker-common/fileutils', {
    writeFileSync: function(filePath: string, content: string): number {
        return 0; // Simulate empty output
    }
});

tmr.run();
