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
                mode: (4 << 6) + (4 << 3) + 4, // r--r--r--
            };
        default:
            throw { code: 'ENOENT' };
    }
});

// override fs.chmodSync. it is the only fs function called by copyfiles.
(fs as any).chmodSync = (path: string, mode: number) => {
    console.log(`chmodSync ${path} ${mode}`);
};
runner.registerMock('fs', fs);

runner.run();
