import * as utilsTests from './L0UtilsTests';
import * as assert from 'assert';
import * as path from 'path';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

describe('CopyFilesOverSSHV0 Suite', function () {
    for (const queue of ['false', 'true']) {
        it(`neutralizes filenames with the upload queue ${queue}`, async function () {
            this.timeout(10000);
            const previous = process.env['OUTPUT_TEST_QUEUE'];
            process.env['OUTPUT_TEST_QUEUE'] = queue;
            try {
                const runner = new MockTestRunner(path.join(__dirname, 'L0LoggingCommands.js'));
                await runner.runAsync();
                assert(runner.succeeded, runner.stdout + runner.stderr);
                assert(runner.stdout.includes('file##_vso[task.setvariable variable=Injected]sentinel.txt'));
                assert(runner.stdout.includes('Original SSH paths preserved'));
                assert(!runner.stdout.split(/\r?\n/).some(line => !line.startsWith('##vso[') &&
                    line.includes('##vso[task.setvariable variable=Injected]')));
            } finally {
                if (previous === undefined) {
                    delete process.env['OUTPUT_TEST_QUEUE'];
                } else {
                    process.env['OUTPUT_TEST_QUEUE'] = previous;
                }
            }
        });
    }

    utilsTests.run();

    if (process.platform === 'win32') {
        require('./L0WindowsUtilsTests').run();
    } else {
        require('./L0LinuxUtilsTests').run();
    }
});
