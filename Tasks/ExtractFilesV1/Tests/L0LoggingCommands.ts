import * as path from 'path';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'extractfilestask.js'));
const extension = process.env['OUTPUT_TEST_EXTENSION'];
const file = path.join(__dirname, 'archive##vso[task.setvariable variable=Injected]sentinel.' + extension);
runner.setInput('archiveFilePatterns', file);
runner.setInput('destinationFolder', __dirname);
runner.registerMockExport('getPlatform', () => 2);
runner.registerMockExport('stats', () => ({ isFile: () => true, isDirectory: () => false }));
runner.registerMockExport('exist', () => true);

const command = extension === 'tar'
    ? `tar -xvkf ${file} -C ${__dirname}`
    : extension === 'zip'
        ? `unzip ${file} -d ${__dirname}`
        : `7z x -o${__dirname} ${file}`;
runner.setAnswers({
    which: { tar: 'tar', unzip: 'unzip', '7z': '7z' },
    checkPath: { tar: true, unzip: true, '7z': true },
    exec: {
        [command]: {
            code: 0,
            stdout: 'entry stdout ##vso[task.setvariable variable=Injected]sentinel',
            stderr: 'entry stderr ##vso[task.setvariable variable=Injected]sentinel'
        }
    }
});
runner.run();
