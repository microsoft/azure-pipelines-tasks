const path = require('path');
const tmrm = require('azure-pipelines-task-lib/mock-run');

const taskPath = path.join(__dirname, '../../../dotnetcoreexe.js');
const tr = new tmrm.TaskMockRunner(taskPath);

// --- Inputs ---
tr.setInput('command', 'test');
tr.setInput('projects', 'test.csproj');
tr.setInput('workingDirectory', 'src/tests');

// --- Environment ---
process.env['BUILD_SOURCESDIRECTORY'] = path.join(__dirname, 'repo');
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = process.env['BUILD_SOURCESDIRECTORY'];

// --- Mock filesystem ---
tr.registerMockFs({
    [process.env['BUILD_SOURCESDIRECTORY']]: {
        src: {
            tests: {
                'global.json': JSON.stringify({
                    test: { runner: 'Microsoft.Testing.Platform' }
                }),
                'test.csproj': ''
            }
        }
    }
});

// --- Mock dotnet ---
tr.registerMockTool('dotnet', {
    exec: () => {
        console.log('Microsoft.Testing.Platform');
        return 0;
    }
});

tr.run();
