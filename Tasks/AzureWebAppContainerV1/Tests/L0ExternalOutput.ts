import * as assert from 'assert';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import { Writable } from 'stream';
import { writeExternalOutput } from 'azure-pipelines-task-lib/externaloutput';
import type { ExternalOutputOptions } from 'azure-pipelines-task-lib/task';

const mode = process.argv[2];
const marker = ['#', '#', 'vso[task.setvariable variable=SYNTHETIC_TEST_MARKER]synthetic-value'].join('');
const calls: Array<{ writer: string; message: string; options?: ExternalOutputOptions }> = [];
const fallback: string[] = [];
let filteredLogOutput = '';
const logDestination = new Writable({
    write(chunk, _encoding, callback) {
        filteredLogOutput += chunk.toString();
        callback();
    }
});

mocker.enable({ warnOnUnregistered: false });
mocker.registerMock('azure-pipelines-task-lib/task', {
    getPipelineFeature: (name: string) => {
        assert.strictEqual(name, 'UseAzureWebAppContainerOutputSanitizationFallback');
        if (mode === 'reader-error') {
            throw new Error('synthetic flag-reader failure');
        }
        return mode === 'on';
    },
    writeExternalOutput: (message: string, options: ExternalOutputOptions) => {
        calls.push({ writer: 'log', message, options });
        if (mode === 'writer-error') {
            throw new Error(`synthetic writer failure: ${marker}`);
        }
        writeExternalOutput(message, { ...options, destination: logDestination });
    },
});

const originalLog = console.log;
console.log = (message?: any, ...optionalParams: any[]) => {
    fallback.push(`log:${String(message)}${optionalParams.map(String).join('')}`);
};

async function run(): Promise<void> {
    const output = await import('../ExternalOutput');
    output.logExternalOutput(marker);

    if (mode === 'on') {
        assert.deepStrictEqual(calls, []);
        assert.deepStrictEqual(fallback, [`log:${marker}`]);
    } else if (mode === 'writer-error') {
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].message, marker + '\n');
        assert.deepStrictEqual(fallback, ['log:Unable to write filtered task output.']);
        assert.strictEqual(fallback.some(message => message.includes(marker)), false);
        assert.strictEqual(filteredLogOutput, '');
    } else {
        assert.strictEqual(calls.length, 1);
        calls.forEach(call => assert.deepStrictEqual(call.options, {
            source: 'remote'
        }));
        assert.deepStrictEqual(calls.map(call => call.writer), ['log']);
        assert.deepStrictEqual(fallback, []);
        assert.strictEqual(filteredLogOutput.includes(marker), false);
        assert.strictEqual(filteredLogOutput.includes(marker.replace('##vso[', '##_vso[')), true);
    }
}

run().then(() => {
    console.log = originalLog;
}).catch(error => {
    console.log = originalLog;
    console.error(error);
    process.exitCode = 1;
});
