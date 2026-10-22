import * as assert from 'assert';
import * as stream from 'stream';
import * as tl from 'azure-pipelines-task-lib/task';
import basecommand from '../src/basecommand';

class TestCommand extends basecommand {
    public getTool(): string { return 'node'; }
    public login(): void {}
    public logout(): void {}
}

describe('Helm external output filtering', function () {
    this.timeout(10000);
    const feature = 'DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS';
    const stdout = 'NAME: release\nNOTES:\n##vso[task.setvariable variable=PATH]untrusted\n##VsO[task.debug]note\n';
    const stderr = 'warning\n##vso[task.complete result=Succeeded;]untrusted\n';
    let previousFeature: string;
    let loggedStdout: string;
    let loggedStderr: string;
    let telemetry: string;

    function capture(write: (value: string) => void): stream.Writable {
        return new stream.Writable({
            write(chunk, encoding, callback) { write(chunk.toString()); callback(); }
        });
    }

    beforeEach(() => {
        previousFeature = process.env[feature];
        loggedStdout = loggedStderr = telemetry = '';
        tl.setStdStream(capture(value => { telemetry += value; }));
    });

    afterEach(() => {
        if (previousFeature === undefined) {
            delete process.env[feature];
        } else {
            process.env[feature] = previousFeature;
        }
        tl.setStdStream(process.stdout);
    });

    for (const featureValue of [undefined, 'false', 'true']) {
        for (const asyncExecution of [false, true]) {
            for (const exitCode of [0, 7]) {
                it(`filters both streams with flag=${featureValue}, async=${asyncExecution}, exit=${exitCode}`, async () => {
                    if (featureValue === undefined) {
                        delete process.env[feature];
                    } else {
                        process.env[feature] = featureValue;
                    }
                    const command = new TestCommand(true);
                    const payload = Buffer.from(JSON.stringify({ stdout, stderr })).toString('base64');
                    const tool = command.createCommand().arg(['-e',
                        `const p = JSON.parse(Buffer.from('${payload}', 'base64'));` +
                        `process.stdout.write(p.stdout.slice(0, 25)); setTimeout(() => {` +
                        `process.stdout.write(p.stdout.slice(25)); process.stderr.write(p.stderr); process.exitCode=${exitCode}; }, 10);`
                    ]);
                    const options = {
                        ignoreReturnCode: true,
                        outStream: capture(value => { loggedStdout += value; }),
                        errStream: capture(value => { loggedStderr += value; })
                    };
                    if (asyncExecution) {
                        assert.strictEqual(await command.execCommand(tool, options), exitCode);
                    } else {
                        const result = command.execCommandSync(tool, options);
                        assert.strictEqual(result.code, exitCode);
                        assert.strictEqual(result.stdout, stdout);
                        assert.strictEqual(result.stderr, stderr);
                    }
                    const blocked = featureValue === 'true';
                    assert(loggedStdout.includes(blocked ? stdout.replace(/##vso\[/g, '##_vso[') : stdout));
                    const expectedStderr = blocked ? stderr.replace(/##vso\[/g, '##_vso[') : stderr;
                    if (asyncExecution) {
                        assert(loggedStdout.includes(expectedStderr));
                        assert.strictEqual(loggedStderr, '');
                    } else {
                        assert.strictEqual(loggedStderr, expectedStderr);
                    }
                    if (blocked) {
                        assert(!loggedStdout.includes('##vso['));
                        assert(!loggedStderr.includes('##vso['));
                    }
                    for (const name of ['task.setvariable', 'task.complete']) {
                        assert(telemetry.includes(`"commandName":"${name}","blocked":${blocked}`));
                    }
                    assert(!telemetry.includes('untrusted'), 'telemetry must not include command values');
                });
            }
        }
    }

    it('preserves silent output and raw results', () => {
        process.env[feature] = 'true';
        const command = new TestCommand(true);
        const result = command.execCommandSync(command.createCommand().arg(['-e', 'console.log("quiet")']), {
            silent: true,
            outStream: capture(value => { loggedStdout += value; }),
            errStream: capture(value => { loggedStderr += value; })
        });
        assert.strictEqual(result.stdout.trim(), 'quiet');
        assert.strictEqual(loggedStdout, '');
        assert.strictEqual(loggedStderr, '');
    });
});
