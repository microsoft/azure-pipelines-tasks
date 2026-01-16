const path = require('path');
const tmrm = require('azure-pipelines-task-lib/mock-run');

const taskPath = path.join(__dirname, '../../../dotnetcoreexe.js');
const tr = new tmrm.TaskMockRunner(taskPath);

// --- Fake repo root ---
const repoRoot = path.join(__dirname, 'repo');

// --- Inputs ---
tr.setInput('command', 'test');
tr.setInput('projects', '**/*.csproj');          // ✅ allow glob to match
tr.setInput('workingDirectory', 'src/tests');   // ✅ matches FS

// --- Environment ---
process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = repoRoot;

// --- Mock filesystem ---
tr.registerMockFs({
    [repoRoot]: {
        src: {
            tests: {
                'global.json': JSON.stringify({
                    test: { runner: 'Microsoft.Testing.Platform' }
                }),
                'test.csproj': '<Project></Project>' // ✅ REQUIRED
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
