import path = require('path');

const tl = require('azure-pipelines-task-lib/task');
const ttm = require('azure-pipelines-task-lib/mock-test');

const taskPath = path.join(__dirname, '../../dist/index.js');

const tr = new ttm.MockTestRunner(taskPath);

// working directory is deeper
tr.setInput('workingDirectory', path.join('src', 'app'));

// repo root
process.env['BUILD_SOURCESDIRECTORY'] = path.resolve('repo');

// mock filesystem
tr.registerMock('fs', {
    existsSync: (p) => {
        if (p.endsWith(path.join('src', 'global.json'))) {
            return true;
        }
        return false;
    }
});

tr.run();