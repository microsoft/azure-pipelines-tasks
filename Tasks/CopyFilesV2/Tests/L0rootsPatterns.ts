import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', 'someOtherDir/file?.file\nsomeOtherDir2/*.file\n!someOtherDir2/file[13].file');
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
    path.normalize('/srcDir/someOtherDir/file-zzz.file'),
    path.normalize('/srcDir/someOtherDir2'),
    path.normalize('/srcDir/someOtherDir2/file1.file'),
    path.normalize('/srcDir/someOtherDir2/file2.file'),
    path.normalize('/srcDir/someOtherDir2/file3.file'),
    path.normalize('/srcDir/someOtherDir3'),
];
runner.setAnswers(answers);

const fsClone = Object.assign({}, fs);
Object.assign(fsClone, {
    existsSync(itemPath: string): boolean {
        switch (itemPath) {
            case path.normalize('/srcDir/someOtherDir/file1.file'):
            case path.normalize('/srcDir/someOtherDir/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file2.file'):
                return true;
            default:
                return false;
        }
    },
    statSync(itemPath: string): fs.Stats {
        const itemStats: fs.Stats = new fs.Stats();
        switch (itemPath) {
            case path.normalize('/srcDir/someOtherDir/file1.file'):
            case path.normalize('/srcDir/someOtherDir/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file2.file'):
                itemStats.isDirectory = () => false;
                break;
            default:
                throw { code: 'ENOENT' };
        }
        return itemStats;
    },
    // as a precaution, disable fs.chmodSync. it should not be called during this scenario.
    chmodSync(p: fs.PathLike, mode: fs.Mode): void {}
});

runner.registerMock('fs', fsClone);

runner.run();
