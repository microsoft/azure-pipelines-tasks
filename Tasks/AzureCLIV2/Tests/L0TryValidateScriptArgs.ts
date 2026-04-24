import assert = require('assert');
import { tryValidateScriptArgs, ArgsSanitizingError } from '../src/argsSanitizer';

// Tests for the outer pipeline-feature gate `EnableAzureCliArgsValidation` and
// the try/catch wrapper around `validateScriptArgs`.
//
// `tl.getPipelineFeature('X')` reads env var `DISTRIBUTEDTASK_TASKS_X`
// (uppercased). The `emitTelemetry` helper writes
// `##vso[telemetry.publish ...]` to stdout when the agent version meets the
// minimum (we set Agent.Version high enough via env to enable it).

const FEATURE_ENV = 'DISTRIBUTEDTASK_TASKS_ENABLEAZURECLIARGSVALIDATION';
const AGENT_VERSION_ENV = 'AGENT_VERSION';

export const runTryValidateScriptArgsTests = () => {
    let originalWrite: typeof process.stdout.write;
    let captured: string;

    const startCapture = () => {
        captured = '';
        originalWrite = process.stdout.write.bind(process.stdout);
        (process.stdout.write as any) = (chunk: string | Buffer, ...args: any[]): boolean => {
            captured += chunk.toString();
            return originalWrite(chunk, ...args);
        };
    };

    const stopCapture = () => {
        process.stdout.write = originalWrite;
    };

    beforeEach(() => {
        delete process.env[FEATURE_ENV];
        process.env[AGENT_VERSION_ENV] = '2.999.0';
    });

    afterEach(() => {
        delete process.env[FEATURE_ENV];
        delete process.env[AGENT_VERSION_ENV];
    });

    it('Flag OFF: does not call validator', () => {
        let called = false;
        tryValidateScriptArgs('anything', 'bash', () => { called = true; });
        assert.strictEqual(called, false, 'validator should not be invoked when the feature is off');
    });

    it('Flag ON, validator succeeds: calls validator with the correct args, no throw', () => {
        process.env[FEATURE_ENV] = 'true';
        const seen: Array<[string, string]> = [];
        assert.doesNotThrow(() => {
            tryValidateScriptArgs('arg1 arg2', 'pscore', (a, t) => { seen.push([a, t]); });
        });
        assert.deepStrictEqual(seen, [['arg1 arg2', 'pscore']]);
    });

    it('Flag ON, validator throws ArgsSanitizingError: rethrows, no telemetry', () => {
        process.env[FEATURE_ENV] = 'true';
        startCapture();
        try {
            assert.throws(
                () => tryValidateScriptArgs('test; whoami', 'bash', () => {
                    throw new ArgsSanitizingError('blocked');
                }),
                ArgsSanitizingError
            );
        } finally {
            stopCapture();
        }
        assert.strictEqual(
            captured.indexOf('telemetry.publish'),
            -1,
            'ArgsSanitizingError is intentional and should not produce ArgsValidationFailure telemetry'
        );
    });

    it('Flag ON, validator throws generic Error: swallows and emits ArgsValidationFailure telemetry', () => {
        process.env[FEATURE_ENV] = 'true';
        startCapture();
        try {
            assert.doesNotThrow(() => tryValidateScriptArgs('args', 'bash', () => {
                const err = new Error('boom');
                err.name = 'CustomError';
                throw err;
            }));
        } finally {
            stopCapture();
        }
        const idx = captured.indexOf('##vso[telemetry.publish');
        assert.notStrictEqual(idx, -1, 'should emit telemetry');
        const line = captured.substring(idx);
        assert.ok(line.indexOf('feature=AzureCLIV2') >= 0, 'feature should be AzureCLIV2');
        assert.ok(line.indexOf('"event":"ArgsValidationFailure"') >= 0, 'event tag missing');
        assert.ok(line.indexOf('"errorName":"CustomError"') >= 0, 'errorName missing');
        assert.ok(line.indexOf('"errorMessage":"boom"') >= 0, 'errorMessage missing');
    });

    it('Flag ON, generic error + telemetry path itself fails: still does not rethrow', () => {
        process.env[FEATURE_ENV] = 'true';
        // Force the telemetry path to no-op without throwing publicly: drop the
        // agent version so emitTelemetry hits the "below minimum" branch and
        // never writes to stdout. The wrapper must still complete normally.
        process.env[AGENT_VERSION_ENV] = '0.0.1';
        startCapture();
        try {
            assert.doesNotThrow(() => tryValidateScriptArgs('args', 'bash', () => {
                throw new Error('inner');
            }));
        } finally {
            stopCapture();
        }
        assert.strictEqual(
            captured.indexOf('##vso[telemetry.publish'),
            -1,
            'no telemetry expected when agent version is below the minimum'
        );
    });
};
