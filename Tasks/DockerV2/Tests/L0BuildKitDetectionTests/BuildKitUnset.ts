import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

// Mock test for DOCKER_BUILDKIT unset (modern Docker default)
let taskPath = path.join(__dirname, '..', '..', 'utils.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Ensure DOCKER_BUILDKIT is not set
delete process.env['DOCKER_BUILDKIT'];

// Mock the task library
tmr.setInput('command', 'build');

// Mock fileutils.writeFileSync to return 0 (empty file)
tmr.registerMock('azure-pipelines-tasks-docker-common/fileutils', {
    writeFileSync: function(filePath: string, content: string): number {
        return 0; // Simulate empty output
    }
});

tmr.run();
