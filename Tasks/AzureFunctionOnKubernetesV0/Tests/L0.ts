import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import { CommandHelper } from '../src/utils/commandHelper';

describe('AzureFunctionOnKubernetesV1 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: Mocha.Done) {
        // TODO - add real tests
        done();
    });
});

// Covers the untrusted func/Docker/kubectl build-output sanitization fix gated behind
// AzureFunctionOnKubernetes.EnableOutputSanitization (see commandHelper.ts/deploy.ts) - both the
// flag-off legacy path and the flag-on enforcement path, including the create/delete-secret
// call-site shape that was initially missed and later added for consistency.
describe('CommandHelper - untrusted output sanitization', function () {
    const ENABLE_OUTPUT_SANITIZATION_VARIABLE = 'AzureFunctionOnKubernetes.EnableOutputSanitization';
    const MARKER = '##vso[task.setvariable variable=PWNED]evil';
    const NEUTRALIZED = '##_vso[task.setvariable variable=PWNED]evil';

    let originalWhich: typeof tl.which;
    let originalWarning: typeof tl.warning;
    let commandHelper: CommandHelper;
    let warnings: string[];

    // Builds a fake ToolRunner-shaped command so execSync() is fully under test control,
    // without needing func/kubectl actually installed on the test agent.
    function fakeCommand(
        result: Partial<tr.IExecSyncResult>,
        capture?: { options?: any }
    ): tr.ToolRunner {
        return ({
            execSync: (options?: any) => {
                if (capture) {
                    capture.options = options;
                }
                return {
                    stdout: result.stdout ?? '',
                    stderr: result.stderr ?? '',
                    code: result.code ?? 0,
                    error: result.error ?? null
                };
            }
        } as any) as tr.ToolRunner;
    }

    before(() => {
        originalWhich = tl.which;
        // Avoid depending on func/kubectl being installed on the test agent.
        (tl as any).which = (tool: string) => tool;
        commandHelper = new CommandHelper();
    });

    after(() => {
        (tl as any).which = originalWhich;
    });

    beforeEach(() => {
        warnings = [];
        originalWarning = tl.warning;
        (tl as any).warning = (msg: string) => { warnings.push(msg); };
    });

    afterEach(() => {
        (tl as any).warning = originalWarning;
        tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, '');
    });

    describe('flag never set / explicitly off (legacy default behavior)', () => {
        it('defaults to legacy (no sanitization) behavior when the variable has never been set', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, '');
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } } as any);
            assert.strictEqual(result.stdout, MARKER);
        });

        it('does not touch markers in stdout, even if externalOutput is (mistakenly) passed', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'false');
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } } as any);
            assert.strictEqual(result.stdout, MARKER, 'stdout must stay byte-for-byte unchanged when the flag is off');
        });

        it('strips externalOutput before calling execSync, preserving all other options unchanged', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'false');
            const capture: { options?: any } = {};
            const command = fakeCommand({ stdout: MARKER, code: 0 }, capture);
            commandHelper.execCommand(command, { cwd: '/tmp', externalOutput: { source: 'childProcess' } } as any);
            assert.strictEqual(capture.options.externalOutput, undefined);
            assert.strictEqual(capture.options.cwd, '/tmp');
        });

        it('warns with the raw/untouched text on a successful exit code with stderr present', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'false');
            const command = fakeCommand({ stderr: MARKER, code: 0 });
            commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } } as any);
            assert.strictEqual(warnings.length, 1);
            assert.strictEqual(warnings[0], MARKER);
        });

        it('throws using the original (unsanitized) message on a non-zero exit code without warnIfError', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'false');
            const command = fakeCommand({ stderr: MARKER, code: 1 });
            assert.throws(
                () => commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } } as any),
                (err: Error) => err.message === MARKER
            );
        });
    });

    describe('flag on (sanitization enforced)', () => {
        beforeEach(() => tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'true'));

        it('neutralizes a ##vso[...] marker in stdout', () => {
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(result.stdout, NEUTRALIZED);
        });

        it('passes externalOutput through to execSync unchanged (live stream is also filtered by task-lib)', () => {
            const capture: { options?: any } = {};
            const command = fakeCommand({ stdout: MARKER, code: 0 }, capture);
            commandHelper.execCommand(command, { cwd: '/tmp', externalOutput: { source: 'childProcess' } });
            assert.deepStrictEqual(capture.options.externalOutput, { source: 'childProcess' });
            assert.strictEqual(capture.options.cwd, '/tmp');
        });

        it('leaves plain, marker-free output completely unchanged', () => {
            const plain = 'Deploying function app...\nDeployment succeeded.';
            const command = fakeCommand({ stdout: plain, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(result.stdout, plain);
        });

        it('neutralizes multiple markers appearing in the same output', () => {
            const multi = `${MARKER}\nsome text\n${MARKER}`;
            const expected = `${NEUTRALIZED}\nsome text\n${NEUTRALIZED}`;
            const command = fakeCommand({ stdout: multi, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(result.stdout, expected);
        });

        it('does not touch a different-case near-miss (exact "##vso[" byte match only, mirroring the agent parser)', () => {
            const nearMiss = '##VSO[task.setvariable variable=PWNED]evil';
            const command = fakeCommand({ stdout: nearMiss, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(result.stdout, nearMiss);
        });

        it('does not crash when stdout/stderr are empty strings', () => {
            const command = fakeCommand({ stdout: '', stderr: '', code: 0 });
            assert.doesNotThrow(() => commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } }));
        });

        it('does nothing when no externalOutput option is provided at all', () => {
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(command);
            assert.strictEqual(result.stdout, MARKER);
        });

        it('treats the feature flag value case-insensitively (e.g. "TRUE")', () => {
            tl.setVariable(ENABLE_OUTPUT_SANITIZATION_VARIABLE, 'TRUE');
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(result.stdout, NEUTRALIZED);
        });

        it('ensures tl.warning() receives the SANITIZED stderr text on a successful exit code', () => {
            const command = fakeCommand({ stderr: MARKER, code: 0 });
            commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } });
            assert.strictEqual(warnings.length, 1);
            assert.strictEqual(warnings[0], NEUTRALIZED, 'the injected command must never reach tl.warning() unsanitized');
        });

        it('throws using the SANITIZED stderr text on a non-zero exit code without warnIfError', () => {
            const command = fakeCommand({ stderr: MARKER, code: 1 });
            assert.throws(
                () => commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } }),
                (err: Error) => err.message === NEUTRALIZED
            );
        });

        it('warns with the sanitized text instead of throwing when warnIfError=true, even on a non-zero exit code', () => {
            const command = fakeCommand({ stderr: MARKER, code: 1 });
            assert.doesNotThrow(() =>
                commandHelper.execCommand(command, { externalOutput: { source: 'childProcess' } }, /* warnIfError */ true)
            );
            assert.strictEqual(warnings.length, 1);
            assert.strictEqual(warnings[0], NEUTRALIZED);
        });

        // Mirrors the exact call-site option shape used by createImagePullSecret() in deploy.ts for
        // the kubectl create/delete-secret commands - the gap this fix closed.
        it('sanitizes output for the create/delete-secret call-site option shape (failOnStdErr + ignoreReturnCode + externalOutput)', () => {
            const command = fakeCommand({ stdout: MARKER, code: 0 });
            const result = commandHelper.execCommand(
                command,
                { failOnStdErr: false, ignoreReturnCode: true, externalOutput: { source: 'childProcess' } } as any,
                true
            );
            assert.strictEqual(result.stdout, NEUTRALIZED);
        });
    });
});
