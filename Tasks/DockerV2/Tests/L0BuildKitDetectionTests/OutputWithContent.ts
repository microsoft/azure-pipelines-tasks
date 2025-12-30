import * as path from 'path';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

// Mock test for output with actual content
let taskPath = path.join(__dirname, '..', '..', 'utils.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// DOCKER_BUILDKIT can be any value - won't matter when output has content
process.env['DOCKER_BUILDKIT'] = '0'; // Use legacy builder to prove no warning when content exists

// Mock the task library
tmr.setInput('command', 'build');

// Mock fileutils.writeFileSync to return >0 (file has content)
tmr.registerMock('azure-pipelines-tasks-docker-common/fileutils', {
    writeFileSync: function(filePath: string, content: string): number {
        return 100; // Simulate output with content
    }
});

tmr.run();
