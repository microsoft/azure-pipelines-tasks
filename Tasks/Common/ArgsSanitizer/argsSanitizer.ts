// Reuses the work-item-75787 argument sanitizer used by BashV3 and the
// PowerShell ArgumentsSanitizer. Three feature flags drive behavior:
//   AZP_75787_ENABLE_NEW_LOGIC      -> throw on disallowed characters
//   AZP_75787_ENABLE_NEW_LOGIC_LOG  -> warn on disallowed characters (audit)
//   AZP_75787_ENABLE_COLLECT        -> emit telemetry only
//
// The sanitizer is dispatched per scriptType so that allowlists and pre-
// expansion match the target shell:
//   * bash         -> BashV3 allowlist (a-zA-Z0-9 _'"-=/:.*+%) and $VAR /
//                     ${VAR} expansion of process env (catches value-
//                     injected secrets like VAR=";rm -rf /").
//   * pscore / ps  -> PowerShellV2 allowlist (adds , ~ ? # and backtick
//                     escaping, plus $true/$false via lookahead) and CR/LF is
//                     always rejected (see hasPsNewline) and
//                     $env:VAR / ${env:VAR} expansion. This is what makes
//                     PowerShell-native syntax like `$env:servicePrincipalKey`
//                     or `-MyBoolean $True` pass.
//                     The allowlist also accepts the PowerShell *data*
//                     constructors `@ { } [ ]` (hashtable, splatting, array,
//                     indexing) — they do not turn data into code in a
//                     PowerShell argument list. The execution primitives that
//                     do (`$( )`, `;`, `&`, `|`, `` ` `` outside the escape
//                     position) remain blocked.
//   * batch        -> Literal-only sanitization with the BashV3 allowlist
//                     (no env expansion; cmd-specific allowlist is a TODO).

import tl = require('azure-pipelines-task-lib/task');
import { sanitizeArgs } from 'azure-pipelines-tasks-utility-common/argsSanitizer';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
import { IssueSource } from 'azure-pipelines-task-lib/internal';
import { spawnSync } from 'child_process';

export class ArgsSanitizingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ArgsSanitizingError';
        // Pin the prototype so `instanceof` survives even if a consumer's tsc target is lowered to ES5.
        Object.setPrototypeOf(this, ArgsSanitizingError.prototype);
    }
}

export interface SanitizerOptions {
    /** Telemetry feature name (area is always 'TaskHub'), e.g. 'AzureCLIV2'. */
    taskName: string;
    /** Optional outer pipeline-feature gate (default OFF), e.g. 'EnableAzureCliArgsValidation'.
     *  Omit for tasks with no outer gate (the AZP_75787_* flags still apply), e.g. PowerShellV2. */
    pipelineFeatureFlag?: string;
    /** Expand $VAR / $env: references against the agent env before sanitizing. Default true; pass
     *  false for tasks whose script runs off-agent (e.g. AzureVmssDeployment). */
    expandEnv?: boolean;
    /** Allow the PowerShell data constructors @ { } [ ]. Default true. Blocked when false, or when
     *  the AZP_75787_ENABLE_STRICT_DATA_CONSTRUCTORS feature flag is on. */
    allowDataConstructors?: boolean;
    /** Loc key for the sanitized-args message. Default 'ScriptArgsSanitized'. */
    messageLocKey?: string;
    /** Loc key for the bash-path message. Default = messageLocKey. */
    bashMessageLocKey?: string;
}

/**
 * MSRC 129198: a CR/LF in a PowerShell script argument (or a FilePath) is a statement separator at
 * the `. '<script>' <args>` dot-source sink, so it injects a new statement. Reject it unconditionally
 * (parity with the AzurePowerShell Windows handler). For tasks that build the wrapper directly and do
 * not run the allow-list sanitizer. Reuses the caller's existing loc keys.
 */
export function assertNoScriptNewline(
    scriptArguments: string | undefined,
    scriptPath: string | undefined,
    isFilePath: boolean,
    argumentsLocKey: string = 'InvalidScriptArguments0',
    scriptPathLocKey: string = 'InvalidScriptPath0'
): void {
    if (isFilePath && scriptArguments && /[\r\n]/.test(scriptArguments)) {
        throw new Error(tl.loc(argumentsLocKey, escapeControlChars(scriptArguments)));
    }
    if (isFilePath && scriptPath && /[\r\n]/.test(scriptPath)) {
        throw new Error(tl.loc(scriptPathLocKey, escapeControlChars(scriptPath)));
    }
}

// Render control characters as visible escapes (\n, \r, \t, \xNN) so a rejected newline is readable in
// logs and cannot smuggle a logging command into the build log. task-lib already URL-escapes ##vso[]
// command properties, so this is log hygiene, not an injection fix.
function escapeControlChar(c: string): string {
    const named: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };
    return named[c] ?? (c.charCodeAt(0) < 0x20 ? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}` : c);
}
function escapeControlChars(s: string): string {
    return s.replace(/[\x00-\x1f]/g, escapeControlChar);
}

export function isPowerShellArgumentAstSafe(inputArguments: string, executable?: string): boolean {
    if (!/[@{}\[\]]/.test(inputArguments)) {
        return true;
    }

    // Validate with the same interpreter the handler runs the script under. The AzurePowerShell Node
    // handler resolves pwsh first and falls back to Windows PowerShell, so mirror that resolution here
    // to avoid a fail-closed over-block when only one is installed (the AST grammar is equivalent).
    const psExe = executable || tl.which('pwsh', false) || tl.which('powershell', false) || 'pwsh';

    const validator = [
        '$inputArgs = [Console]::In.ReadToEnd()',
        '$tokens = $null',
        '$parseErrors = $null',
        '$ast = [System.Management.Automation.Language.Parser]::ParseInput("& placeholder $inputArgs", [ref]$tokens, [ref]$parseErrors)',
        'if ($parseErrors.Count -gt 0) { exit 2 }',
        '$dangerous = $ast.FindAll({ param($node) ($node -is [System.Management.Automation.Language.ScriptBlockExpressionAst]) -or ($node -is [System.Management.Automation.Language.MemberExpressionAst]) -or ($node -is [System.Management.Automation.Language.ConvertExpressionAst]) -or ($node -is [System.Management.Automation.Language.TypeExpressionAst]) -or (($node -is [System.Management.Automation.Language.BinaryExpressionAst]) -and ($node.Operator -eq [System.Management.Automation.Language.TokenKind]::As)) }, $true)',
        'if ($dangerous.Count -gt 0) { exit 3 }',
        '$commands = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)',
        'if ($commands.Count -gt 1) { exit 4 }'
    ].join('; ');
    const result = spawnSync(psExe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', validator], {
        input: inputArguments,
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true
    });

    return isAstProbeResultSafe(result);
}

// Fail closed: the arguments are proven safe only by a clean exit 0. Any spawn error (ENOENT for a
// missing interpreter, ETIMEDOUT for a hung one) or a non-zero exit (parse error, dangerous node, or
// more than one command) means safety could not be established, so a slow or broken interpreter blocks.
export function isAstProbeResultSafe(result: { error?: Error | null; status: number | null }): boolean {
    return !result.error && result.status === 0;
}

// Outer gate (`EnableAzureCliArgsValidation`, default OFF) decides whether the
// sanitizer runs at all. When it runs, every exception thrown by the validator
// (intentional `ArgsSanitizingError` blocks as well as unexpected errors) is
// reported as an `ArgsValidationFailure` telemetry event and then rethrown so
// the task fails.
export function tryValidateScriptArgs(
    inputArguments: string,
    scriptType: string,
    opts: SanitizerOptions,
    validator: (args: string, type: string, opts: SanitizerOptions) => void = validateScriptArgs
): void {
    // Outer gate: a per-task pipeline feature (e.g. EnableAzureCliArgsValidation, default OFF).
    // Absent => no outer gate; the caller relies solely on the AZP_75787_* flags (e.g. PowerShellV2).
    if (opts.pipelineFeatureFlag && !tl.getPipelineFeature(opts.pipelineFeatureFlag)) {
        return;
    }
    try {
        validator(inputArguments, scriptType, opts);
    } catch (err) {
        const e = err as { name?: string; message?: string };
        tl.debug(`validateScriptArgs threw: ${e?.message ?? err}`);
        try {
            emitTelemetry('TaskHub', opts.taskName, {
                event: 'ArgsValidationFailure',
                scriptType: (scriptType || 'unknown').toLowerCase(),
                errorName: e?.name ?? 'Unknown',
                errorMessage: e?.message ?? String(err)
            });
        } catch (telemetryErr) {
            tl.debug(`Failed to emit ArgsValidationFailure telemetry: ${telemetryErr}`);
        }
        throw err;
    }
}

type BashEnvTelemetry = {
    foundPrefixes: number,
    quottedBlocks: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    braceSyntaxEntries: number,
    bracedVariables: number,
    variablesWithESInside: number,
    unmatchedQuotes: number,
    notClosedBraceSyntaxPosition: number,
    indirectExpansionTries: number,
    invalidEnvName: number,
    notExistingEnv: number
};

export function expandBashEnvVariables(argsLine: string): [string, BashEnvTelemetry] {
    const envPrefix = '$';
    const quote = '\'';
    const escapingSymbol = '\\';

    let result = argsLine;
    let startIndex = 0;
    const telemetry: BashEnvTelemetry = {
        foundPrefixes: 0,
        quottedBlocks: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        braceSyntaxEntries: 0,
        bracedVariables: 0,
        variablesWithESInside: 0,
        unmatchedQuotes: 0,
        notClosedBraceSyntaxPosition: 0,
        indirectExpansionTries: 0,
        invalidEnvName: 0,
        notExistingEnv: 0
    };

    while (true) {
        const prefixIndex = result.indexOf(envPrefix, startIndex);
        if (prefixIndex < 0) {
            break;
        }

        telemetry.foundPrefixes++;

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!(result[prefixIndex - 2]) || result[prefixIndex - 2] !== escapingSymbol) {
                startIndex++;
                result = result.substring(0, prefixIndex - 1) + result.substring(prefixIndex);

                telemetry.escapedVariables++;

                continue;
            }

            telemetry.escapedEscapingSymbols++;
        }

        const quoteIndex = result.indexOf(quote, startIndex);
        if (quoteIndex >= 0 && prefixIndex > quoteIndex) {
            const nextQuoteIndex = result.indexOf(quote, quoteIndex + 1);
            if (nextQuoteIndex < 0) {
                telemetry.unmatchedQuotes = 1;
                break;
            }

            startIndex = nextQuoteIndex + 1;

            telemetry.quottedBlocks++;

            continue;
        }

        let envName = '';
        let envEndIndex = 0;
        let isBraceSyntax = false;

        if (result[prefixIndex + 1] === '{') {
            isBraceSyntax = true;

            telemetry.braceSyntaxEntries++;
        }

        const envStartIndex = prefixIndex + envPrefix.length + +isBraceSyntax;

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex);
            if (envEndIndex === 0) {
                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1;
                break;
            }

            if (result[prefixIndex + envPrefix.length + 1] === '!') {
                telemetry.indirectExpansionTries++;
                startIndex = envEndIndex;
                continue;
            }

            envName = result.substring(envStartIndex, envEndIndex);

            telemetry.bracedVariables++;
        } else {
            envName = result.substring(envStartIndex).split(/[ |"|'|;]/)[0];
            envEndIndex = envStartIndex + envName.length;
        }

        if (!isValidEnvName(envName)) {
            telemetry.invalidEnvName++;
            startIndex = envEndIndex;
            continue;
        }

        const head = result.substring(0, prefixIndex);
        if (!isBraceSyntax && envName.includes(escapingSymbol)) {
            telemetry.variablesWithESInside++;
        }

        let envValue = { ...process.env }[envName];
        if (!envValue) {
            telemetry.notExistingEnv++;
            startIndex = envEndIndex;
            continue;
        }

        const tail = result.substring(envEndIndex + +isBraceSyntax);

        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length;

        telemetry.variablesExpanded++;
    }

    return [result, telemetry];
}

function findEnclosingBraceIndex(input: string, targetIndex: number): number {
    for (let i = 0; i < input.length; i++) {
        if (input[i] === '}' && i > targetIndex) {
            return i;
        }
    }
    return 0;
}

function isValidEnvName(envName: string): boolean {
    const regex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return regex.test(envName);
}

// PowerShellV2-compatible $env: / ${env:} pre-expansion. Mirrors the logic in
// Tasks/PowerShellV2/helpers.ts::expandPowerShellEnvVariables so that pscore/ps
// args are sanitized after the same expansion the PowerShell runner would do.
type ProcessEnvPowerShellTelemetry = {
    foundPrefixes: number,
    someVariablesInsideQuotes: number,
    variablesExpanded: number,
    escapedVariables: number,
    escapedEscapingSymbols: number,
    variableStartsFromBacktick: number,
    variablesWithBacktickInside: number,
    envQuottedBlocks: number,
    braceSyntaxEntries: number,
    bracedVariables: number,
    notClosedBraceSyntaxPosition: number,
    bracedEnvSyntax: number,
    notExistingEnv: number
};

export function expandPowerShellEnvVariables(argsLine: string): [string, ProcessEnvPowerShellTelemetry] {
    const basicEnvPrefix = '$env:';
    const bracedEnvPrefix = '${env:';
    const quote = '\'';
    const escapingSymbol = '`';

    const telemetry: ProcessEnvPowerShellTelemetry = {
        foundPrefixes: 0,
        someVariablesInsideQuotes: 0,
        variablesExpanded: 0,
        escapedVariables: 0,
        escapedEscapingSymbols: 0,
        variableStartsFromBacktick: 0,
        variablesWithBacktickInside: 0,
        envQuottedBlocks: 0,
        braceSyntaxEntries: 0,
        bracedVariables: 0,
        notClosedBraceSyntaxPosition: 0,
        bracedEnvSyntax: 0,
        notExistingEnv: 0
    };

    let result = argsLine;
    let startIndex = 0;

    while (true) {
        const loweredResult = result.toLowerCase();
        const basicPrefixIndex = loweredResult.indexOf(basicEnvPrefix, startIndex);
        const bracedPrefixIndex = loweredResult.indexOf(bracedEnvPrefix, startIndex);

        const foundPrefixes = [basicPrefixIndex, bracedPrefixIndex].filter(i => i >= 0);
        if (foundPrefixes.length === 0) {
            break;
        }

        const prefixIndex = Math.min(...foundPrefixes);
        const isBraceSyntax = prefixIndex === bracedPrefixIndex;
        if (isBraceSyntax) {
            telemetry.braceSyntaxEntries++;
        }

        if (prefixIndex < 0) {
            break;
        }

        telemetry.foundPrefixes++;

        if (result[prefixIndex - 1] === escapingSymbol) {
            if (!result[prefixIndex - 2] || result[prefixIndex - 2] !== escapingSymbol) {
                startIndex++;
                result = result.substring(0, prefixIndex - 1) + result.substring(prefixIndex);
                telemetry.escapedVariables++;
                continue;
            }
            telemetry.escapedEscapingSymbols++;
        }

        const quoteIndex = result.indexOf(quote, startIndex);
        if (quoteIndex >= 0 && prefixIndex > quoteIndex) {
            const nextQuoteIndex = result.indexOf(quote, quoteIndex + 1);
            if (nextQuoteIndex < 0) {
                break;
            }
            startIndex = nextQuoteIndex + 1;
            continue;
        }

        let envName = '';
        let envEndIndex = 0;
        const envStartIndex = prefixIndex + (isBraceSyntax ? bracedEnvPrefix.length : basicEnvPrefix.length);

        if (isBraceSyntax) {
            envEndIndex = findEnclosingBraceIndex(result, prefixIndex);
            if (envEndIndex === 0) {
                telemetry.notClosedBraceSyntaxPosition = prefixIndex + 1;
                break;
            }
            envName = result.substring(envStartIndex, envEndIndex);
            telemetry.bracedVariables++;
        } else {
            // Note: PowerShellV2's original split is /[ |"|'|;|$]/ which fails
            // when arguments come from a YAML folded scalar (`arguments: >`)
            // because \n / \r / \t are not treated as delimiters and the env
            // name grabs across the line break. Use \s so any whitespace ends
            // the env name (matches how PowerShell tokenizes arguments).
            envName = result.substring(envStartIndex).split(/[\s|"|'|;|$]/)[0];
            envEndIndex = envStartIndex + envName.length;
        }

        if (envName.startsWith(escapingSymbol)) {
            const sanitizedEnvName = basicEnvPrefix + envName.substring(1);
            result = result.substring(0, prefixIndex) + sanitizedEnvName + result.substring(envEndIndex);
            startIndex = prefixIndex + sanitizedEnvName.length;
            telemetry.variableStartsFromBacktick++;
            continue;
        }

        let head = result.substring(0, prefixIndex);
        if (envName.includes(escapingSymbol)) {
            head = head + envName.split(escapingSymbol)[1];
            envName = envName.split(escapingSymbol)[0];
            telemetry.variablesWithBacktickInside++;
        }

        const envValue = process.env[envName];
        if (!envValue) {
            telemetry.notExistingEnv++;
            startIndex = envEndIndex;
            continue;
        }

        const tail = result.substring(isBraceSyntax ? envEndIndex + 1 : envEndIndex);
        result = head + envValue + tail;
        startIndex = prefixIndex + envValue.length;
        telemetry.variablesExpanded++;
    }

    return [result, telemetry];
}

export function validateScriptArgs(inputArguments: string, scriptType: string, opts: SanitizerOptions = { taskName: 'unknown' }): void {
    const featureFlags = {
        audit: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC_LOG'),
        activate: tl.getBoolFeatureFlag('AZP_75787_ENABLE_NEW_LOGIC'),
        telemetry: tl.getBoolFeatureFlag('AZP_75787_ENABLE_COLLECT')
    };

    if (!(featureFlags.activate || featureFlags.audit || featureFlags.telemetry)) {
        return;
    }

    if (!inputArguments) {
        return;
    }

    tl.debug('Validating script args...');

    const normalizedScriptType = (scriptType || '').toLowerCase();
    const isBash = normalizedScriptType === 'bash';
    const isPowerShell = normalizedScriptType === 'pscore' || normalizedScriptType === 'ps';

    // MSRC 129198 hardening (CR/LF rejection and the data-constructor AST backstop) is gated behind
    // its own DistributedTask.Tasks.* pipeline features so it can be rolled out ring-by-ring, AND it
    // only takes effect where the org sanitization toggle is already enforcing (AZP_75787_ENABLE_NEW_LOGIC).
    // Both default off => this function behaves exactly like the WI-75787 character sanitizer.
    const enforce = featureFlags.activate;
    const newlineValidation = enforce && tl.getPipelineFeature('EnableScriptArgumentsNewlineValidation');
    const expressionValidation = enforce && tl.getPipelineFeature('EnableScriptArgumentsExpressionValidation');

    let expandedArgs = inputArguments;
    let envTelemetry: BashEnvTelemetry | ProcessEnvPowerShellTelemetry | null = null;

    // Some tasks (e.g. AzureVmssDeployment) run the script on a remote machine, where expanding the
    // agent's environment is the wrong context; they pass expandEnv:false to skip it.
    if (opts.expandEnv !== false) {
        if (isBash) {
            [expandedArgs, envTelemetry] = expandBashEnvVariables(inputArguments);
            tl.debug(`Expanded script args: ${expandedArgs}`);
        } else if (isPowerShell) {
            [expandedArgs, envTelemetry] = expandPowerShellEnvVariables(inputArguments);
            tl.debug(`Expanded script args: ${expandedArgs}`);
        }
    }

    // Relaxed PowerShell allowlist additionally permits the data constructors @ { } [ ] (hashtable,
    // splatting, array, indexing). Those can re-enable bind-time expression evaluation (e.g.
    // `@{ k = <command> }`), which a pure allowlist can't detect, so a strict mode that drops them is
    // available via AZP_75787_ENABLE_STRICT_DATA_CONSTRUCTORS (default off) or opts.allowDataConstructors=false.
    const allowDataConstructors = opts.allowDataConstructors !== false
        && !tl.getBoolFeatureFlag('AZP_75787_ENABLE_STRICT_DATA_CONSTRUCTORS');
    const [sanitizedArgs, sanitizerTelemetry] = isPowerShell
        ? sanitizeArgs(expandedArgs, {
            // PowerShell allowlist: word chars + \ ` _ ' " - = / : . * , + ~ ? % \n # (+ @ { } [ ] when relaxed).
            // Backtick is PowerShell's escape symbol; (?!true|false) lets $True / $false pass.
            // \n is allow-listed here (parity with the deployed WI-75787 sanitizer) so a lone LF is NOT
            // blocked by the char pass; a lone LF is rejected only by the FF-gated hasPsNewline below, so
            // the EnableScriptArgumentsNewlineValidation feature is the sole ring-by-ring control for it.
            // \r is NOT allow-listed, so CR / CRLF remain blocked (unchanged from deployed behavior).
            // Execution primitives $( ) ; & | remain blocked.
            argsSplitSymbols: '``',
            saniziteRegExp: allowDataConstructors
                ? new RegExp("(?<!`)([^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%\\n#@{}\\[\\]])(?!true|false)", 'ig')
                : new RegExp("(?<!`)([^\\w\\\\` _'\"\\-=\\/:\\.*,+~?%\\n#])(?!true|false)", 'ig')
        })
        : sanitizeArgs(expandedArgs, {
            // BashV3 allowlist (also used for batch and unknown scriptType).
            argsSplitSymbols: '\\\\',
            saniziteRegExp: new RegExp("(?<!\\\\)([^a-zA-Z0-9\\\\ _'\"\\-=\\/:.*+%])", 'g')
        });
    // The AST backstop runs only when the expression-validation feature is on (and the org is enforcing).
    // When off it does not even spawn, and astSafe is true. It is also moot in strict mode, where the
    // char allowlist already strips @ { } [ ]. inputArguments is the text that actually reaches the sink;
    // expandedArgs is screened too (defense in depth) only when $env: expansion changed the string — an
    // env value is an inert argument token at the dot-source sink, so this can only over-block, never miss.
    // Validate on the same interpreter the sink runs under: 'ps' => Windows PowerShell, 'pscore' => pwsh
    // (the default pwsh||powershell already matches pscore and the AzurePowerShell Node handler).
    const runAst = isPowerShell && allowDataConstructors && expressionValidation;
    const astExecutable = runAst && normalizedScriptType === 'ps'
        ? (tl.which('powershell', false) || tl.which('pwsh', false) || undefined)
        : undefined;
    const astSafe = !runAst
        || (isPowerShellArgumentAstSafe(inputArguments, astExecutable)
            && (expandedArgs === inputArguments || isPowerShellArgumentAstSafe(expandedArgs, astExecutable)));

    // CR/LF is a statement separator at the `. '<script>' <args>` dot-source sink (MSRC 129198). It is
    // rejected only when the newline-validation feature is on (and the org is enforcing). Test the
    // expanded form so a newline introduced via $env: expansion is caught too.
    const hasPsNewline = isPowerShell && newlineValidation && /[\r\n]/.test(expandedArgs);

    // Two different comparands, intentionally: the early-out below returns only when nothing was
    // sanitized relative to the RAW input (so a no-op is truly a no-op), while the block/telemetry
    // path compares against expandedArgs so that any change introduced by $env: expansion is reported.
    if (sanitizedArgs === inputArguments && !hasPsNewline && astSafe) {
        return;
    }

    if (featureFlags.telemetry && (sanitizerTelemetry || envTelemetry || !astSafe)) {
        const telemetry = {
            scriptType: normalizedScriptType || 'unknown',
            ...(envTelemetry ?? {}),
            ...(sanitizerTelemetry ?? {}),
            ...(!astSafe ? { astBackstopRejected: true } : {})
        };
        try {
            emitTelemetry('TaskHub', opts.taskName, telemetry);
        } catch (e) {
            tl.debug(`Failed to emit script-args sanitizer telemetry: ${e}`);
        }
    }

    if (sanitizedArgs !== expandedArgs || hasPsNewline || !astSafe) {
        const offendingChars = collectOffendingChars(
            (sanitizerTelemetry as { removedSymbols?: Record<string, number> } | null)?.removedSymbols,
            hasPsNewline
        );
        const messageKey = isBash
            ? (opts.bashMessageLocKey ?? opts.messageLocKey ?? 'ScriptArgsSanitized')
            : (opts.messageLocKey ?? 'ScriptArgsSanitized');
        let message = tl.loc(messageKey);
        if (offendingChars) {
            message = `${message} Offending characters: ${offendingChars}.`;
        } else if (!astSafe) {
            message = `${message} The arguments contain a PowerShell expression that would be evaluated at runtime (for example a command, a method or property access, a cast, or a script block inside a data constructor); pass only literal values.`;
        }
        if (featureFlags.activate) {
            throw new ArgsSanitizingError(message);
        }
        if (featureFlags.audit) {
            tl.warning(message, IssueSource.TaskInternal, 1);
        }
    }
}

// Build a human-readable list of the disallowed characters that were removed
// during sanitization, so the error message names exactly what to fix. Control
// characters are rendered as escape sequences (\n, \r, \t, \xNN) so a rejected
// newline is both visible and cannot inject a logging command into the build log.
function collectOffendingChars(removedSymbols: Record<string, number> | undefined, hasPsNewline?: boolean): string {
    const chars = new Set<string>(removedSymbols ? Object.keys(removedSymbols) : []);
    // A backtick-preceded newline is exempted by the allowlist lookbehind, so name it explicitly.
    if (hasPsNewline) {
        chars.add('\n');
    }
    if (chars.size === 0) {
        return '';
    }
    return [...chars].map(c => `'${escapeControlChar(c)}'`).join(', ');
}
