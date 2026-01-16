const tmrm = require('azure-pipelines-task-lib/mock-run');
const path = require('path');

const tr = new tmrm.TaskMockRunner(path.join(__dirname, '../../dotnetcoreexe.js'));

process.env['BUILD_SOURCESDIRECTORY'] = path.join(__dirname, '..');
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = process.env['BUILD_SOURCESDIRECTORY'];

tr.setInput('command', 'test');
tr.setInput('projects', 'test.csproj');
tr.setInput('workingDirectory', 'src/tests');

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

tr.registerMockTool('dotnet', {
    exec: () => {
        console.log('Microsoft.Testing.Platform');
        return 0;
    }
});

tr.run();