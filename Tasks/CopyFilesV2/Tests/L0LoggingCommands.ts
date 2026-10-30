import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'copyfiles.js'));
const source = path.normalize('/source');
const destination = path.normalize('/destination');
const name = 'file##vso[task.setvariable variable=Injected]sentinel.txt';
const file = path.join(source, name);
const target = path.join(destination, name);

runner.setInput('SourceFolder', source);
runner.setInput('TargetFolder', destination);
runner.setInput('Contents', '**');
runner.setInput('retryCount', '2');
runner.setInput('delayBetweenRetries', '0');
runner.setInput('preserveTimestamp', 'true');
runner.setAnswers({
    checkPath: { [source]: true },
    find: { [source]: [file] }
});
runner.registerMock('fs', {
    ...fs,
    existsSync: (value: string) => value === file,
    statSync: () => ({ isDirectory: () => false, atime: new Date(0), mtime: new Date(0) }),
    utimes: (_file: string, _atime: Date, _mtime: Date, callback: (error: Error) => void) =>
        callback(new Error('timestamp ##vso[task.setvariable variable=Injected]sentinel'))
});
runner.registerMockExport('mkdirP', () => {});
let attempts = 0;
runner.registerMockExport('cp', (actualSource: string, actualTarget: string) => {
    assert.strictEqual(actualSource, file);
    assert.strictEqual(actualTarget, target);
    if (++attempts === 1) {
        throw new Error('retry ##vso[task.setvariable variable=Injected]sentinel');
    }
    console.log('Original paths preserved');
});
runner.run();
