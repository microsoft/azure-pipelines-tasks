import assert = require('assert');
import { validateScriptArgs, ArgsSanitizingError } from '../src/argsSanitizer';

// Tests cover the AZP_75787_* feature-flag triplet shared with BashV3 and the
// PowerShell ArgumentsSanitizer. Bash scripts get $VAR / ${VAR} expansion
// before sanitization; pscore/ps/batch sanitize the literal scriptArguments.

export const runValidateScriptArgsTests = () => {
    const setEnv = (envVariables: string[]) => {
        envVariables.forEach(envVariable => {
            const [envName, envValue] = envVariable.split('=');
            process.env[envName] = envValue;
        });
    };
    const clearEnv = (envVariables: string[]) => {
        envVariables.forEach(envVariable => {
            const [envName] = envVariable.split('=');
            delete process.env[envName];
        });
    };

    const notThrowTestSuites: [string, string, string, string[]][] = [
        ['Handles empty line (bash)', '', 'bash', []],
        ['Handles empty line (pscore)', '', 'pscore', []],
        ['No dangerous symbol present, FF on (bash)',
            'test 1', 'bash', ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['Dangerous symbols present but FF off (bash)',
            'test; test', 'bash', ['AZP_75787_ENABLE_NEW_LOGIC=false']],
        ['Bash arg references env var with no dangerous symbols',
            'test $VAR1 test', 'bash',
            ['VAR1=1', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['Allowed symbols accepted',
            'a A 1 \\ _ \' " - = / : . * + %', 'bash',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // pscore must NOT expand $VAR (no shell injection into a non-bash shell
        // by way of a value). Note: the $ character is itself forbidden by the
        // allowlist, so we cannot use a literal '$VAR1' here. Instead, prove
        // non-expansion by setting an env var to a forbidden value but not
        // referencing it in the args.
        ['pscore: env vars are not consulted',
            'literal-only-args', 'pscore',
            ['VAR1=12;3', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        // pscore literal sanitization passes when the literal is clean
        ['pscore: clean literal allowed',
            '-Name foo -Value 42', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']]
    ];

    for (const [testName, inputArguments, scriptType, envVariables] of notThrowTestSuites) {
        it(testName, () => {
            setEnv(envVariables);
            try {
                assert.doesNotThrow(() => validateScriptArgs(inputArguments, scriptType));
            } finally {
                clearEnv(envVariables);
            }
        });
    }

    const throwTestSuites: [string, string, string, string[]][] = [
        ['Bash: dangerous symbols present, FF on',
            'test; whoami', 'bash',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['Bash: env var holds dangerous symbols',
            'test $VAR1 test', 'bash',
            ['VAR1=12;3', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['Bash: malformed brace syntax in args',
            'test ${VAR1 test', 'bash',
            ['VAR1=123', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: dangerous symbols in literal, FF on',
            'test; whoami', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['batch: dangerous symbols in literal, FF on',
            'test & whoami', 'batch',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']]
    ];

    for (const [testName, inputArguments, scriptType, envVariables] of throwTestSuites) {
        it(testName, () => {
            setEnv(envVariables);
            try {
                assert.throws(() => validateScriptArgs(inputArguments, scriptType), ArgsSanitizingError);
            } finally {
                clearEnv(envVariables);
            }
        });
    }
};
