import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**\n!**/someOtherDir2/**');
runner.setInput('SourceFolder', path.normalize('/srcDir'));
runner.setInput('TargetFolder', path.normalize('/destDir'));
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'false');
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
    path.normalize('/srcDir/someOtherDir2'),
    path.normalize('/srcDir/someOtherDir2/file1.file'),
    path.normalize('/srcDir/someOtherDir2/file2.file'),
    path.normalize('/srcDir/someOtherDir2/file3.file'),
    path.normalize('/srcDir/someOtherDir3'),
];
runner.setAnswers(answers);
runner.registerMockExport('stats', (itemPath: string) => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize('/srcDir/someOtherDir'):
        case path.normalize('/srcDir/someOtherDir2'):
        case path.normalize('/srcDir/someOtherDir3'):
            return { isDirectory: () => true };
        case path.normalize('/srcDir/someOtherDir/file1.file'):
        case path.normalize('/srcDir/someOtherDir/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file1.file'):
        case path.normalize('/srcDir/someOtherDir2/file2.file'):
        case path.normalize('/srcDir/someOtherDir2/file3.file'):
            return { isDirectory: () => false };
        default:
            throw { code: 'ENOENT' };
    }
});

// as a precaution, disable fs.chmodSync. it should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
