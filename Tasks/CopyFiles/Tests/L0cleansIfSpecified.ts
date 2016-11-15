import fs = require('fs');
import mockanswer = require('vsts-task-lib/mock-answer');
import mockrun = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', '/srcDir');
runner.setInput('TargetFolder', '/destDir');
runner.setInput('CleanTargetFolder', 'true');
runner.setInput('Overwrite', 'false');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: {
        '/srcDir': true
    },
    find: {
        '/srcDir': [
            '/srcDir/someOtherDir',
            '/srcDir/someOtherDir/file1.file',
            '/srcDir/someOtherDir/file2.file'
        ]
    },
    match: { },
    rmRF: {
        '/destDir': {
            success: true
        }
    }
};
answers.match[path.join('/srcDir', '**')] = [
    '/srcDir/someOtherDir/file1.file',
    '/srcDir/someOtherDir/file2.file'
];
runner.setAnswers(answers);
runner.registerMockExport('stats', (path: string) => {
    switch (path) {
        case '/srcDir/someOtherDir':
            return { isDirectory: () => true };
        case '/srcDir/someOtherDir/file1.file':
        case '/srcDir/someOtherDir/file2.file':
            return { isDirectory: () => false };
        default:
            throw { code: 'ENOENT' };
    }
});

// as a precaution, disable fs.chmodSync. it is the only fs function
// called by copyfiles and should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
