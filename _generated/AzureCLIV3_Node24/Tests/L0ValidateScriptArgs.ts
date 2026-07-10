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
        // Regression #22173: arguments: > YAML folded scalars introduce \n.
        ['pscore: newline whitespace from folded scalar allowed',
            '-One 1\n-Two 2\n-Three 3', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // pscore allows backtick-escaped otherwise-disallowed characters.
        ['pscore: backtick-escaped @ allowed',
            '-Items `@items', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
        // Regression #22173 (second break): PowerShell data constructors —
        // hashtable, splatting, array literal, indexing, type accelerator —
        // are NOT execution primitives in a PowerShell argument list. They
        // must pass so customers can pass `-Tag @{...}` (the failing case in
        // the issue) without redirecting through env vars.
        //
        // Note: `;` and `( )` remain blocked because they are execution primitives.
        // Hashtables can use newline separators (which
        // is the customer's exact case — YAML folded scalar produces \n).
        // Array literals `@(...)` cannot be expressed without `( )` and stay
        // blocked; callers can pass arrays via env vars or splatting.
        ['pscore: hashtable literal @{ K = "v" } allowed (newline-separated)',
            '-Tag @{ Solution = "RunnerImagesGeneration"\n      ManagedBy = "Platform-Team" }', 'pscore',
            ['AZP_75787_ENABLE_NEW_LOGIC=true']],
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
        // Closest reproduction of feliasson's case from issue #22173: a
        // YAML folded-scalar hashtable with $env:* references for the values
        // that would otherwise be ADO macros.
        ['pscore: issue #22173 hashtable literal (folded scalar) passes',
            '-Tag @{\n      Solution            = "RunnerImagesGeneration"\n      ManagedBy           = "Platform-Team"\n      RequestedFor        = $env:requestedFor\n    }', 'pscore',
            ['requestedFor=someone@contoso.com', 'AZP_75787_ENABLE_NEW_LOGIC=true']]
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

    // Regression test for https://github.com/microsoft/azure-pipelines-tasks/issues/22173.
    // Reconstructs the exact arguments string the task would see *after* ADO has
    // already substituted ${{ parameters.* }} and $(varName), preserving the
    // YAML folded-scalar \n characters that the user's telemetry reported as
    // `removedSymbols: { "$": 4, "{": 1, "\n": 11, "}": 1 }`. Under pscore the
    // four `$env:*` references must be resolved by expandPowerShellEnvVariables,
    // `$True` must pass the (?!true|false) lookahead, and the embedded
    // newlines must pass the PowerShell allowlist that includes `\n`.
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
        ].join('\n');

        const repoEnv = [
            'AZP_75787_ENABLE_NEW_LOGIC=true',
            'servicePrincipalId=spnId-clean',
            'idToken=idToken-clean',
            'servicePrincipalKey=secret-clean'
        ];

        it('pscore: original failing arguments pass after PowerShell expansion', () => {
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
