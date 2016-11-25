import fs = require('fs');
import mockanswer = require('vsts-task-lib/mock-answer');
import mockrun = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', '/srcDir');
runner.setInput('TargetFolder', '/destDir');
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'true');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: {
        '/srcDir': true
    },
    find: {
        '/srcDir': [
            '/srcDir/someOtherDir',
            '/srcDir/someOtherDir/file1.file',
            '/srcDir/someOtherDir/file2.file',
        ]
    },
    match: { }
};
answers.match[path.join('/srcDir', '**')] = [
    '/srcDir/someOtherDir/file1.file',
    '/srcDir/someOtherDir/file2.file',
];
runner.setAnswers(answers);
runner.registerMockExport('stats', (p: string): any => {
    switch (p) {
        case '/srcDir/someOtherDir':
        case path.join('/destDir', 'someOtherDir'):
            return { isDirectory: () => true };
        case '/srcDir/someOtherDir/file1.file':
        case '/srcDir/someOtherDir/file2.file':
            return { isDirectory: () => false };
        case path.join('/destDir', 'someOtherDir', 'file1.file'):
            return {
                isDirectory: () => false,
                mode: (6 << 6) + (6 << 3) + 6, // rw-rw-rw-
            };
        default:
            throw { code: 'ENOENT' };
    }
});

// as a precaution, disable fs.chmodSync. it is the only fs function
// called by copyfiles and should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
