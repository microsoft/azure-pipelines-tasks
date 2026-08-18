import assert = require('assert');
import tl = require('azure-pipelines-task-lib/task');
import { validateScriptArgs, ArgsSanitizingError, isPowerShellArgumentAstSafe, isAstProbeResultSafe } from 'azure-pipelines-tasks-args-sanitizer/argsSanitizer';

// Tests cover the AZP_75787_* feature-flag triplet shared with BashV3 and the
// PowerShell ArgumentsSanitizer. Bash scripts get $VAR / ${VAR} expansion
// before sanitization; pscore/ps/batch sanitize the literal scriptArguments.

export const runValidateScriptArgsTests = () => {
    it('PowerShell AST validation allows pure data and rejects evaluated constructor expressions', () => {
        // The benign-PASS case needs a real PowerShell to exit 0; skip it where no interpreter exists
        // (e.g. a pwsh-less macOS agent). The fail-closed negatives below are interpreter-independent.
        if (tl.which('pwsh', false) || tl.which('powershell', false)) {
            assert(isPowerShellArgumentAstSafe('-Tags @{ env = "prod"; port = 8080 }'));
        }
        assert(!isPowerShellArgumentAstSafe('@{ k = New-Item -Path C:\\evil.txt -ItemType File -Force }'));
        assert(!isPowerShellArgumentAstSafe('@{ k = [System.Net.Dns]::MachineName }'));
        // Fail closed: a missing interpreter must block a constructor expression, never silently allow it.
        assert(!isPowerShellArgumentAstSafe('@{ k = New-Item C:\\evil }', 'pwsh-does-not-exist-xyz'));
    });

    it('AST probe result is interpreted fail-closed (timeout, missing interpreter, non-zero exit)', () => {
        // Ivan review (#22428): "if the timeout has passed, what would happen?" A hung interpreter makes
        // spawnSync set error=ETIMEDOUT (status null); a missing one sets ENOENT; a rejected payload exits
        // non-zero. Only a clean exit 0 is safe. Deterministic - no spawned process, no timing dependency.
        assert.strictEqual(isAstProbeResultSafe({ error: Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }), status: null }), false);
        assert.strictEqual(isAstProbeResultSafe({ error: Object.assign(new Error('ENOENT'), { code: 'ENOENT' }), status: null }), false);
        assert.strictEqual(isAstProbeResultSafe({ status: 2 }), false);
        assert.strictEqual(isAstProbeResultSafe({ status: 3 }), false);
        assert.strictEqual(isAstProbeResultSafe({ status: 4 }), false);
        assert.strictEqual(isAstProbeResultSafe({ status: 0 }), true);
    });

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
        // pscore must NOT expand bash-style $VAR (no shell injection into a
        // non-bash shell by way of a value). Prove non-expansion by setting an
        // env var to a forbidden value but not referencing it in the args.
        ['pscore: bash-style env vars are not consulted',
            'literal-only-args', 'pscore',
            ['VAR1=12;3', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        // pscore literal sanitization passes when the literal is clean
        ['pscore: clean literal allowed',
            '-Name foo -Value 42', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Regression #22173: $env:VAR is the canonical way to reference a
        // pipeline secret in pscore; it must pass after PowerShell expansion.
        ['pscore: $env:VAR reference is expanded and allowed',
            '-AzureClientSecret $env:servicePrincipalKey', 'pscore',
            ['servicePrincipalKey=secretValue', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: ${env:VAR} braced reference is expanded and allowed',
            '-AzureClientSecret ${env:servicePrincipalKey}', 'pscore',
            ['servicePrincipalKey=secretValue', 'AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Regression #22173: -MyBoolean $True is valid PowerShell.
        ['pscore: $True literal allowed',
            '-UseAzureCliAuth $True', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: $false literal allowed (case-insensitive)',
            '-Flag $false', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // pscore allows backtick-escaped otherwise-disallowed characters.
        ['pscore: backtick-escaped @ allowed',
            '-Items `@items', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Regression #22173 (second break): PowerShell data constructors —
        // hashtable, splatting, array literal, indexing, type accelerator —
        // are NOT execution primitives in a PowerShell argument list. They
        // must pass so customers can pass `-Tag @{...}` (the failing case in
        // the issue) without redirecting through env vars. Single-line only:
        // MSRC 129198 rejects a CR/LF anywhere in the args when enforce is on.
        //
        // Note: `;` and `( )` remain blocked because they are execution primitives.
        // Array literals `@(...)` cannot be expressed without `( )` and stay
        // blocked; callers can pass arrays via env vars or splatting.
        ['pscore: splatting @params allowed',
            'Invoke-Build @params', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: type accelerator [string] allowed',
            '-Cast [string]', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: literal index [0] allowed',
            '-Index [0]', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: hashtable value containing @ (email) allowed',
            '-Tag @{ Owner = "team@contoso.com" }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Mode matrix: audit (LOG) and collect only warn / emit telemetry — they must NOT throw,
        // even for the newline, character and AST-constructor injection vectors that enforce blocks.
        ['pscore: audit mode warns but does not throw on ; separator',
            'test; whoami', 'pscore', ['AZP_75787_ENABLE_NEW_LOGIC_LOG=true']],
        ['pscore: collect mode does not throw on ; separator',
            'test; whoami', 'pscore', ['AZP_75787_ENABLE_COLLECT=true']],
        ['pscore: audit mode does not throw on newline',
            '-Foo bar\nWrite-Host x', 'pscore', ['AZP_75787_ENABLE_NEW_LOGIC_LOG=true']],
        ['pscore: audit mode does not throw on command-valued hashtable (AST)',
            '-Tag @{ k = New-Item -Path C:\\evil.txt -ItemType File -Force }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC_LOG=true']],
        ['pscore: collect mode does not throw on command-valued hashtable (AST)',
            '-Tag @{ k = [System.Net.Dns]::MachineName }', 'pscore',
            ['AZP_75787_ENABLE_COLLECT=true']],
        // MSRC 129198 ring-by-ring gates: a new check is inert unless BOTH its own FF and the enforce
        // toggle (AZP_75787_ENABLE_NEW_LOGIC) are on. None of these may throw.
        ['pscore: AST injection inert when expression FF off (enforce on)',
            '@{ k = New-Item C:\\x }', 'pscore', ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: AST injection inert when enforce off (expression FF on, collect on)',
            '@{ k = New-Item C:\\x }', 'pscore',
            ['AZP_75787_ENABLE_COLLECT=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSEXPRESSIONVALIDATION=true']],
        ['pscore: backtick-escaped newline inert when newline FF off (enforce on)',
            '-Name `\nvalue', 'pscore', ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: lone LF inert when newline FF off (enforce on) - deployed parity',
            '-Foo bar\nWrite-Host x', 'pscore', ['AZP_75787_ENABLE_NEW_LOGIC=true']]
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
        ['pscore: semicolon command separator',
            'test; whoami', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: pipe character',
            'test | whoami', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: && command chain',
            'test && whoami', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // MSRC 129198: a lone LF is allow-listed by the char sanitizer (deployed parity) and is rejected
        // only under the EnableScriptArgumentsNewlineValidation feature; CR / CRLF stay blocked by the
        // char sanitizer (\r is not allow-listed) regardless of the newline feature.
        ['pscore: lone LF injects a statement, blocked under the newline feature (MSRC 129198)',
            '-Foo bar\nWrite-Host INJECTED', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSNEWLINEVALIDATION=true']],
        ['pscore: CRLF in args rejected by the char sanitizer (enforce only)',
            '-One 1\r\n-Two 2', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: multi-line hashtable rejected under the newline feature (MSRC 129198; use single-line)',
            '-Tag @{ a = 1\n b = 2 }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSNEWLINEVALIDATION=true']],
        ['pscore: $env: value containing a lone LF blocked under the newline feature (MSRC 129198)',
            '-x $env:EVIL', 'pscore',
            ['EVIL=a\nwhoami', 'AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSNEWLINEVALIDATION=true']],
        ['pscore: bare $ that is not $true/$false/$env',
            '-Name $other', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Attack primitives must remain blocked even when wrapped
        // in otherwise-allowed PowerShell data syntax. Hashtable values that
        // contain $(subexpression) are the canonical command-injection vector
        // when an attacker controls a template-parameter substitution.
        ['pscore: hashtable value with $(subexpression) still blocked',
            '-Tag @{ Cmd = "$(Get-Date)" }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: $(rm -rf /) subexpression in args still blocked',
            '-Path $(rm -rf /)', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: & call operator still blocked',
            '-Cmd & evil.exe', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: array literal @(...) still blocked (parens are execution-position)',
            '-Items @("a","b","c")', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: hashtable with semicolon separator still blocked',
            '-Tag @{ a = 1; b = 2 }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        ['pscore: command as hashtable value blocked by AST validation',
            '-Tag @{ k = New-Item -Path C:\\evil.txt -ItemType File -Force }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSEXPRESSIONVALIDATION=true']],
        ['pscore: property access as hashtable value blocked by AST validation',
            '-Tag @{ k = [System.Net.Dns]::MachineName }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSEXPRESSIONVALIDATION=true']],
        ['pscore: backtick-escaped newline blocked when newline FF on (MSRC 129198)',
            '-Name `\nvalue', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSNEWLINEVALIDATION=true']],
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

    it('Error message names the offending characters', () => {
        const env = ['AZP_75787_ENABLE_NEW_LOGIC=true'];
        setEnv(env);
        try {
            assert.throws(
                () => validateScriptArgs('test; whoami | id', 'pscore'),
                (err: Error) => err instanceof ArgsSanitizingError
                    && /Offending characters:/.test(err.message)
                    && err.message.includes("';'")
                    && err.message.includes("'|'")
            );
        } finally {
            clearEnv(env);
        }
    });

    // Ivan review (#22428): scriptArguments may carry secrets, so a validation failure must never echo
    // the argument values. validateScriptArgs reports only the offending characters (or a generic AST
    // description), so a secret embedded in the arguments is not exposed in the build log.
    describe('Failure messages never echo argument values (secret non-exposure)', () => {
        const SECRET = 'SuperSecretValue123';

        it('character rejection names only the offending character, not the value', () => {
            const env = ['AZP_75787_ENABLE_NEW_LOGIC=true'];
            setEnv(env);
            try {
                assert.throws(
                    () => validateScriptArgs(`-Password ${SECRET}; whoami`, 'pscore'),
                    (err: Error) => err instanceof ArgsSanitizingError
                        && err.message.includes("';'")
                        && !err.message.includes(SECRET)
                );
            } finally {
                clearEnv(env);
            }
        });

        it('newline rejection names only the newline escape, not the surrounding value', () => {
            const env = ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSNEWLINEVALIDATION=true'];
            setEnv(env);
            try {
                assert.throws(
                    () => validateScriptArgs(`-Token ${SECRET}\nWrite-Host x`, 'pscore'),
                    (err: Error) => err instanceof ArgsSanitizingError
                        && err.message.includes("'\\n'")
                        && !err.message.includes(SECRET)
                );
            } finally {
                clearEnv(env);
            }
        });

        it('AST rejection uses a generic description, not the argument value', () => {
            const env = ['AZP_75787_ENABLE_NEW_LOGIC=true', 'DISTRIBUTEDTASK_TASKS_ENABLESCRIPTARGUMENTSEXPRESSIONVALIDATION=true'];
            setEnv(env);
            try {
                assert.throws(
                    () => validateScriptArgs(`-Tag @{ k = New-Item -Path C:\\${SECRET} -ItemType File }`, 'pscore'),
                    (err: Error) => err instanceof ArgsSanitizingError
                        && /PowerShell expression that would be evaluated/.test(err.message)
                        && !err.message.includes(SECRET)
                );
            } finally {
                clearEnv(env);
            }
        });
    });

    // Regression test for https://github.com/microsoft/azure-pipelines-tasks/issues/22173.
    // Reconstructs the arguments string the task would see *after* ADO has substituted
    // ${{ parameters.* }} and $(varName). Under pscore the four `$env:*` references must be
    // resolved by expandPowerShellEnvVariables and `$True` must pass the (?!true|false)
    // lookahead. Single-line: MSRC 129198 now rejects a CR/LF in the args (the folded-scalar
    // \n form is covered by the throw-suite), so the args are space-joined here.
    describe('Issue #22173 reproducer (AzureCLI@2 / @3 pscore with $env: and $True)', () => {
        const issue22173Args = [
            '-ImageType Ubuntu2204',
            '-SubscriptionId 00000000-0000-0000-0000-000000000000',
            '-AzureLocation westeurope',
            '-NameSuffix test01',
            '-GalleryPublisherName contoso',
            '-AzureTenantId 00000000-0000-0000-0000-000000000001',
            '-AzureClientId $env:servicePrincipalId',
            '-AzureClientIdToken $env:idToken',
            '-AzureClientSecret $env:servicePrincipalKey',
            '-TempResourceGroupName rg-test-01',
            '-UseAzureCliAuth $True',
            '-Tag tag1'
        ].join(' ');

        const repoEnv = [
            'AZP_75787_ENABLE_NEW_LOGIC=true',
            'servicePrincipalId=spnId-clean',
            'idToken=idToken-clean',
            'servicePrincipalKey=secret-clean'
        ];

        it('pscore: single-line #22173 args pass after PowerShell expansion', () => {
            setEnv(repoEnv);
            try {
                assert.doesNotThrow(() => validateScriptArgs(issue22173Args, 'pscore'));
            } finally {
                clearEnv(repoEnv);
            }
        });

        it('bash: same arguments still fail (bash sanitizer does not recognize $env:)', () => {
            setEnv(repoEnv);
            try {
                assert.throws(() => validateScriptArgs(issue22173Args, 'bash'), ArgsSanitizingError);
            } finally {
                clearEnv(repoEnv);
            }
        });
    });
};
