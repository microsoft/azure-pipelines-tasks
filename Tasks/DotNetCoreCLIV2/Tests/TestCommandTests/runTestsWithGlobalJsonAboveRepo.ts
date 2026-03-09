import path = require('path');


const ttm = require('azure-pipelines-task-lib/mock-test');

const taskPath = path.join(__dirname, '../../dist/index.js');
const tr = new ttm.MockTestRunner(taskPath);

tr.setInput('workingDirectory', path.join('src', 'app'));

process.env['BUILD_SOURCESDIRECTORY'] = path.resolve('repo');

tr.registerMock('fs', {
    existsSync: (p) => {
        if (p.endsWith('global.json') && p.includes('agent')) {
            return true;
        }
        return false;
    }
});

tr.run();