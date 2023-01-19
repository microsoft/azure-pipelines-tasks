import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const { promisify } = require('util');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', path.normalize('/srcDir'));
runner.setInput('TargetFolder', path.normalize('/destDir'));
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'false');
runner.setInput('preserveTimestamp', 'true');
let answers = <mockanswer.TaskLibAnswers>{
    checkPath: {},
    find: {},
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

const fsClone = Object.assign({}, fs);
Object.assign(fsClone, {
    existsSync(itemPath: string): boolean {
        switch (itemPath) {
            case path.normalize('/srcDir/someOtherDir'):
            case path.normalize('/srcDir/someOtherDir2'):
            case path.normalize('/srcDir/someOtherDir3'):
            case path.normalize('/srcDir/someOtherDir/file1.file'):
            case path.normalize('/srcDir/someOtherDir/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file1.file'):
            case path.normalize('/srcDir/someOtherDir2/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file3.file'):
                return true;
            default:
                return false;
        }
    },
    statSync(itemPath: string): fs.Stats {
        const itemStats: fs.Stats = new fs.Stats();
        switch (itemPath) {
            case path.normalize('/srcDir/someOtherDir'):
            case path.normalize('/srcDir/someOtherDir2'):
            case path.normalize('/srcDir/someOtherDir3'):
                itemStats.isDirectory = () => true;
                break;
            case path.normalize('/srcDir/someOtherDir/file1.file'):
            case path.normalize('/srcDir/someOtherDir/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file1.file'):
            case path.normalize('/srcDir/someOtherDir2/file2.file'):
            case path.normalize('/srcDir/someOtherDir2/file3.file'):
                itemStats.isDirectory = () => false;
                break;
            default:
                throw { code: 'ENOENT' };
        }
        return itemStats;
    },
    utimes(targetPath, atime, mtime, err): void {
        console.log('Calling fs.utimes on', targetPath);
    }
});

runner.registerMock('fs', fsClone);

runner.run();
