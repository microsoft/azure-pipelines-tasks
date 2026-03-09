import path = require('path');

const ttm = require('azure-pipelines-task-lib/mock-test');

const taskPath = path.join(__dirname, '../../dist/index.js');
const tr = new ttm.MockTestRunner(taskPath);

tr.setInput('workingDirectory', path.join('src', 'app'));

process.env['BUILD_SOURCESDIRECTORY'] = path.resolve('repo');

// global.json does not exist
tr.registerMock('fs', {
    existsSync: () => false
});

tr.run();