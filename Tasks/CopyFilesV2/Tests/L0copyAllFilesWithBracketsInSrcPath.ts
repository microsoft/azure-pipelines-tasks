import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', path.normalize('/srcDir [bracket]'));
runner.setInput('TargetFolder', path.normalize('/destDir'));
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'false');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: { },
    find: { },
};
answers.checkPath[path.normalize('/srcDir [bracket]')] = true;
answers.find[path.normalize('/srcDir [bracket]')] = [
    path.normalize('/srcDir [bracket]'),
    path.normalize('/srcDir [bracket]/someOtherDir'),
    path.normalize('/srcDir [bracket]/someOtherDir/file1.file'),
    path.normalize('/srcDir [bracket]/someOtherDir/file2.file'),
    path.normalize('/srcDir [bracket]/someOtherDir2'),
    path.normalize('/srcDir [bracket]/someOtherDir2/file1.file'),
    path.normalize('/srcDir [bracket]/someOtherDir2/file2.file'),
    path.normalize('/srcDir [bracket]/someOtherDir2/file3.file'),
    path.normalize('/srcDir [bracket]/someOtherDir3'),
];
runner.setAnswers(answers);
runner.registerMockExport('stats', (itemPath: string) => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize('/srcDir [bracket]/someOtherDir'):
        case path.normalize('/srcDir [bracket]/someOtherDir2'):
        case path.normalize('/srcDir [bracket]/someOtherDir3'):
            return { isDirectory: () => true };
        case path.normalize('/srcDir [bracket]/someOtherDir/file1.file'):
        case path.normalize('/srcDir [bracket]/someOtherDir/file2.file'):
        case path.normalize('/srcDir [bracket]/someOtherDir2/file1.file'):
        case path.normalize('/srcDir [bracket]/someOtherDir2/file2.file'):
        case path.normalize('/srcDir [bracket]/someOtherDir2/file3.file'):
            return { isDirectory: () => false };
        default:
            throw { code: 'ENOENT' };
    }
});

// as a precaution, disable fs.chmodSync. it should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
