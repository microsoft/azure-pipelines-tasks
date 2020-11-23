import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import Path = require('path');

let taskPath = Path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', Path.normalize('/srcDir'));
runner.setInput('TargetFolder', Path.normalize('/destDir'));
runner.setInput('CleanTargetFolder', 'true');
runner.setInput('Overwrite', 'false');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: { },
    find: { },
    rmRF: { },
};
answers.checkPath[Path.normalize('/srcDir')] = true;
answers.find[Path.normalize('/srcDir')] = [
    Path.normalize('/srcDir'),
    Path.normalize('/srcDir/someOtherDir'),
    Path.normalize('/srcDir/someOtherDir/file1.file'),
    Path.normalize('/srcDir/someOtherDir/file2.file'),
];
answers.rmRF[Path.join(Path.normalize('/destDir/clean-subDir'))] = { success: true };
answers.rmRF[Path.join(Path.normalize('/destDir/clean-file.txt'))] = { success: true };
runner.setAnswers(answers);
runner.registerMockExport('stats', (itemPath: string) => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case Path.normalize('/destDir'):
            return { isDirectory: () => true };
        case Path.normalize('/srcDir'):
        case Path.normalize('/srcDir/someOtherDir'):
            return { isDirectory: () => true };
        case Path.normalize('/srcDir/someOtherDir/file1.file'):
        case Path.normalize('/srcDir/someOtherDir/file2.file'):
            return { isDirectory: () => false };
        default:
            throw { code: 'ENOENT' };
    }
});
let origReaddirSync = fs.readdirSync;

fs.readdirSync = function(path) {
    console.log('HERE path ' + path);
    // let result: string[];
    let result;
    if (path == Path.normalize('/destDir')) {
        result = [ 'clean-subDir', 'clean-file.txt' ];
    }
    else {
        result = origReaddirSync(path);
    }

    return result;
}

// as a precaution, disable fs.chmodSync. it should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
