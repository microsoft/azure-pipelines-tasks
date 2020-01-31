import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', path.normalize('/srcDir'));
runner.setInput('TargetFolder', path.normalize('/destDir'));
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'true');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: { },
    find: { },
};
answers.checkPath[path.normalize('/srcDir')] = true;
answers.find[path.normalize('/srcDir')] = [
    path.normalize('/srcDir'),
    path.normalize('/srcDir/someOtherDir'),
    path.normalize('/srcDir/someOtherDir/file1.file'),
    path.normalize('/srcDir/someOtherDir/file2.file'),
];
runner.setAnswers(answers);
runner.registerMockExport('stats', (itemPath: string): any => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize('/srcDir/someOtherDir'):
        case path.normalize('/destDir/someOtherDir'):
            return { isDirectory: () => true };
        case path.normalize('/srcDir/someOtherDir/file1.file'):
        case path.normalize('/srcDir/someOtherDir/file2.file'):
            return { isDirectory: () => false };
        case path.normalize('/destDir/someOtherDir/file1.file'):
            return {
                isDirectory: () => false,
                mode: (4 << 6) + (4 << 3) + 4, // r--r--r--
            };
        default:
            throw { code: 'ENOENT' };
    }
});

// override fs.chmodSync
(fs as any).chmodSync = (path: string, mode: number) => {
    console.log(`##vso[task.debug]chmodSync ${path} ${mode}`);
};
runner.registerMock('fs', fs);

runner.run();
